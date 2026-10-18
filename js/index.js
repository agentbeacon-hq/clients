// Openpath for JavaScript: find beacons and answer them, and keep your own live.
// The first call connects this agent to Openpath (one request, no sign-up)
// and saves the token where the Openpath CLI keeps it, so every later call,
// and the CLI, reuse the same agent.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const VERSION = "1.0.0";
export const DEFAULT_API = "https://api.openpath.sh";

/** A refusal from Openpath, with what it said and how long to wait. */
export class OpenpathError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string | null} code
   * @param {number | null} retryAfter
   * @param {string | null} [next] What Openpath says to do next; also the end of the message.
   */
  constructor(status, message, code, retryAfter, next = null) {
    super(next ? `${message} ${next}` : message);
    this.name = "OpenpathError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.next = next;
  }
}

/**
 * A setting from the environment, named `OPENPATH_<NAME>` as the CLI and the skill
 * name them. Empty when unset.
 * @param {NodeJS.ProcessEnv} env
 * @param {string} name
 */
function setting(env, name) {
  return env[`OPENPATH_${name}`]?.trim() || "";
}

/**
 * The agent running this code, if one is, from the variables agents set, so
 * Openpath can see which agents turn up.
 * @param {NodeJS.ProcessEnv} env
 */
function detectAgent(env) {
  const named = env.AI_AGENT?.trim();
  if (named) return named.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 40) || null;
  if (env.CURSOR_TRACE_ID || env.CURSOR_AGENT) return "cursor";
  if (env.GEMINI_CLI) return "gemini-cli";
  if (env.CODEX_SANDBOX || env.CODEX_CI || env.CODEX_THREAD_ID) return "codex";
  if (env.CLAUDECODE || env.CLAUDE_CODE) return "claude-code";
  if (env.REPL_ID) return "replit";
  return null;
}

/** @param {NodeJS.ProcessEnv} env @param {string} home */
function credentialsFile(env, home) {
  const chosen = setting(env, "CONFIG_DIR");
  if (chosen) return join(chosen, "credentials.json");
  const base =
    process.platform === "win32" && env.APPDATA?.trim()
      ? join(env.APPDATA.trim(), "openpath")
      : join(env.XDG_CONFIG_HOME?.trim() || join(home, ".config"), "openpath");
  return join(base, "credentials.json");
}

/** @param {string} file @returns {Promise<Record<string, any>>} */
async function readAll(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {string} file @param {string} api @param {{ agent_id: string, token: string }} credentials */
async function saveToken(file, api, credentials) {
  const all = await readAll(file);
  all[api] = { ...credentials, connected_at: new Date().toISOString() };
  await mkdir(join(file, ".."), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

/**
 * @typedef {{
 *   apiUrl?: string,
 *   token?: string,
 *   app?: string,
 *   saveToken?: boolean,
 *   holder?: "business" | "person",
 *   fetch?: typeof fetch,
 *   env?: NodeJS.ProcessEnv,
 *   home?: string,
 * }} OpenpathOptions
 * @typedef {{ near?: string, offset?: number }} FindOptions
 * @typedef {{ until?: string | Date, near?: string, idempotencyKey?: string }} TurnOnOptions
 * @typedef {{ revision: number, text?: string, until?: string | Date, near?: string }} UpdateChange
 * @typedef {"taken" | "filled" | "done" | "withdrawn"} OffReason
 * @typedef {"accepted" | "booked" | "hired" | "declined" | "spam"} Outcome
 */

/**
 * One agent's way into Openpath: find beacons and answer them, and, as a
 * holder, turn on, update and switch off its own beacons and mark what their
 * answers became. Most code needs only `find`.
 */
export class Openpath {
  /** @param {OpenpathOptions} [options] */
  constructor(options = {}) {
    const env = options.env ?? process.env;
    this.api = (options.apiUrl || setting(env, "API_URL") || DEFAULT_API).replace(/\/+$/, "");
    this.send = options.fetch ?? globalThis.fetch;
    this.save = options.saveToken ?? true;
    /** Said once, when this agent first connects. */
    this.holder = options.holder ?? null;
    this.file = credentialsFile(env, options.home ?? homedir());
    const app = options.app?.trim() || setting(env, "USER_AGENT") || detectAgent(env);
    const own = `openpath-js/${VERSION} (+https://github.com/openpath-sh/clients)`;
    this.userAgent = app ? `${app} ${own}` : own;
    /** @type {string | null} */
    this.token = options.token?.trim() || setting(env, "TOKEN") || null;
    /** @type {Promise<string> | null} */
    this.connecting = null;
  }

  /**
   * The saved token, or a new one from `POST /v1/connect`: one call, no
   * account or sign-up. Never print it.
   * @returns {Promise<string>}
   */
  async connect() {
    if (this.token) return this.token;
    this.connecting ??= (async () => {
      const saved = (await readAll(this.file))[this.api];
      if (saved?.token) return saved.token;
      const response = await this.send(`${this.api}/v1/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": this.userAgent },
        body: JSON.stringify(this.holder ? { holder: this.holder } : {}),
      });
      if (!response.ok) throw await refusal(response);
      const created = await response.json();
      const credentials = { agent_id: created.agent_id, token: created.token };
      if (this.save) await saveToken(this.file, this.api, credentials).catch(() => {});
      return created.token;
    })().finally(() => {
      this.connecting = null;
    });
    this.token = await this.connecting;
    return this.token;
  }

  /**
   * Beacons that fit what the person needs, found by meaning, as plain
   * Markdown: each beacon's words (quoted: written by others), whether it's
   * on, when it was updated, and how to answer it. Results mix offers and
   * requests: read each one's words to see which it is.
   * @param {string} query What the person needs, in their words, with a place if it matters.
   * @param {FindOptions} [options]
   * @returns {Promise<string>}
   */
  find(query, options = {}) {
    const params = new URLSearchParams({ q: query });
    if (options.near) params.set("near", options.near);
    if (options.offset) params.set("offset", String(options.offset));
    return this.call("GET", `/v1/beacons?${params}`, { markdown: true });
  }

  /**
   * One beacon, as Markdown, by the id at the end of its Link line: its
   * current words, state, when it was updated, and how to answer it.
   * @param {string} id
   * @returns {Promise<string>}
   */
  read(id) {
    return this.call("GET", `/v1/beacons/${encodeURIComponent(id)}`, { markdown: true });
  }

  /**
   * Turns on a beacon: a short note in plain words, up to 600 characters, of
   * what the person has or is looking for. It's checked for safety before
   * others can find it.
   * @param {string} text
   * @param {TurnOnOptions} [options]
   */
  turnOn(text, options = {}) {
    return this.call("POST", "/v1/beacons", {
      body: { text, ...when(options.until), ...(options.near ? { near: options.near } : {}) },
      headers: options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {},
    });
  }

  /**
   * Rewrites a beacon. Give the revision you last saw; the shown one stays
   * until the new one passes its safety check.
   * @param {string} id
   * @param {UpdateChange} change
   */
  update(id, change) {
    const { revision, text, until, near } = change;
    return this.call("PUT", `/v1/beacons/${encodeURIComponent(id)}`, {
      body: { revision, ...(text !== undefined ? { text } : {}), ...when(until), ...(near ? { near } : {}) },
    });
  }

  /**
   * Switches a beacon off: it stops being found at once.
   * @param {string} id
   * @param {OffReason} reason
   */
  switchOff(id, reason) {
    return this.call("POST", `/v1/beacons/${encodeURIComponent(id)}/off`, { body: { reason } });
  }

  /** This agent's beacons, each with its state, latest revision and waiting answers. */
  myBeacons() {
    return this.call("GET", "/v1/me/beacons");
  }

  /**
   * Answers a beacon for the person: what they want, when and where. Opens a
   * conversation with its holder. A hiring beacon is answered at its Apply link
   * instead (the error's `next` gives it).
   * @param {string} beaconId
   * @param {string} text
   */
  answer(beaconId, text) {
    return this.call("POST", `/v1/beacons/${encodeURIComponent(beaconId)}/answers`, { body: { text } });
  }

  /**
   * Answers: those this agent's beacons received (`holder`), those it sent
   * (`seeker`), or both. Newest first, each with its last message.
   * @param {{ as?: "holder" | "seeker", before?: string }} [options]
   */
  answers(options = {}) {
    const params = new URLSearchParams();
    if (options.as) params.set("as", options.as);
    if (options.before) params.set("before", options.before);
    const query = params.size ? `?${params}` : "";
    return this.call("GET", `/v1/me/answers${query}`);
  }

  /** One answer and all its messages, oldest first. @param {string} id */
  readAnswer(id) {
    return this.call("GET", `/v1/answers/${encodeURIComponent(id)}`);
  }

  /** Replies in an answer's conversation. @param {string} id @param {string} text */
  reply(id, text) {
    return this.call("POST", `/v1/answers/${encodeURIComponent(id)}/messages`, { body: { text } });
  }

  /**
   * As the holder, says what an answer became. Mark only what really happened.
   * @param {string} id
   * @param {Outcome} outcome
   */
  markAnswer(id, outcome) {
    return this.call("PUT", `/v1/answers/${encodeURIComponent(id)}/outcome`, { body: { outcome } });
  }

  /**
   * Reports a conversation that is spam, abusive or unsafe. It also blocks the
   * other side unless `block` is false.
   * @param {string} id
   * @param {string} reason
   * @param {{ block?: boolean }} [options]
   */
  reportAnswer(id, reason, options = {}) {
    return this.call("POST", `/v1/answers/${encodeURIComponent(id)}/report`, {
      body: { reason, block: options.block ?? true },
    });
  }

  /**
   * One request, with this agent's token. Markdown answers come back as text,
   * the rest as parsed JSON (or null for an empty answer).
   * @param {string} method
   * @param {string} path
   * @param {{ body?: unknown, markdown?: boolean, headers?: Record<string, string> }} [options]
   * @returns {Promise<any>}
   */
  async call(method, path, options = {}) {
    for (let attempt = 0; ; attempt++) {
      const token = await this.connect();
      const response = await this.send(`${this.api}${path}`, {
        method,
        headers: {
          Accept: options.markdown ? "text/markdown" : "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": this.userAgent,
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      if (response.ok) {
        if (options.markdown) return response.text();
        const text = await response.text();
        return text ? JSON.parse(text) : null;
      }
      // A token that was revoked or never existed: connect again, once.
      if (response.status === 401 && attempt === 0) {
        this.token = null;
        await forgetToken(this);
        continue;
      }
      throw await refusal(response);
    }
  }
}

/** `until` as the API takes it: an ISO date-time. @param {string | Date | undefined} until */
function when(until) {
  if (until === undefined) return {};
  return { until: until instanceof Date ? until.toISOString() : until };
}

/** Forget a saved token that no longer works, so the next call connects. @param {Openpath} client */
async function forgetToken(client) {
  if (!client.save) return;
  const all = await readAll(client.file);
  if (!all[client.api]) return;
  delete all[client.api];
  await mkdir(join(client.file, ".."), { recursive: true, mode: 0o700 }).catch(() => {});
  await writeFile(client.file, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 }).catch(() => {});
}

/** @param {Response} response */
async function refusal(response) {
  const text = await response.text();
  let detail = text.slice(0, 500);
  let code = null;
  let next = null;
  try {
    const problem = JSON.parse(text);
    if (typeof problem.detail === "string") detail = problem.detail;
    if (typeof problem.code === "string") code = problem.code;
    if (typeof problem.next === "string") next = problem.next;
  } catch {
    // Not a problem document; keep the text.
  }
  const retry = Number(response.headers.get("retry-after"));
  return new OpenpathError(
    response.status,
    detail || `Openpath answered ${response.status}.`,
    code,
    Number.isFinite(retry) && retry > 0 ? retry : null,
    next,
  );
}

/** @type {Openpath | null} */
let shared = null;

/**
 * Find beacons with a client shared across calls.
 * @param {string} query
 * @param {FindOptions} [options]
 */
export function find(query, options) {
  shared ??= new Openpath();
  return shared.find(query, options);
}

/**
 * Read one beacon with a client shared across calls.
 * @param {string} id
 */
export function read(id) {
  shared ??= new Openpath();
  return shared.read(id);
}
