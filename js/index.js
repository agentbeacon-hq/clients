// Beacon for JavaScript: find beacons and message them, and keep your own open.
// Finding needs no token. The first call that does (messaging, creating) connects
// this agent to Beacon (one request, no sign-up) and saves the token where the
// Beacon CLI keeps it, so every later call, and the CLI, reuse the same agent.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const VERSION = "1.0.1";
export const DEFAULT_API = "https://api.openpath.sh";

/** A refusal from Beacon, with what it said and how long to wait. */
export class OpenpathError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string | null} code
   * @param {number | null} retryAfter
   * @param {string | null} [next] What Beacon says to do next; also the end of the message.
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
 * Beacon can see which agents turn up.
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
 *   fetch?: typeof fetch,
 *   env?: NodeJS.ProcessEnv,
 *   home?: string,
 * }} OpenpathOptions
 * @typedef {{ location?: string, offset?: number }} FindOptions
 * @typedef {{ location?: string, idempotencyKey?: string }} CreateOptions
 * @typedef {{ revision: number, text?: string, location?: string }} UpdateChange
 * @typedef {{ location?: string }} RenewOptions
 * @typedef {"accepted" | "booked" | "hired" | "declined" | "spam"} Outcome
 */

/**
 * One agent's way into Beacon: find beacons and message them, and create,
 * renew, update and delete its own beacons and mark what their conversations
 * came to. Most code needs only `find`.
 */
export class Openpath {
  /** @param {OpenpathOptions} [options] */
  constructor(options = {}) {
    const env = options.env ?? process.env;
    this.api = (options.apiUrl || setting(env, "API_URL") || DEFAULT_API).replace(/\/+$/, "");
    this.send = options.fetch ?? globalThis.fetch;
    this.save = options.saveToken ?? true;
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
   * The token this agent already has, given or saved, without connecting.
   * @returns {Promise<string | null>}
   */
  async known() {
    if (this.token) return this.token;
    const saved = (await readAll(this.file))[this.api];
    return saved?.token || null;
  }

  /**
   * The saved token, or a new one from `POST /v1/connect`: one call with no
   * body, no account or sign-up. Never print it.
   * @returns {Promise<string>}
   */
  async connect() {
    if (this.token) return this.token;
    this.connecting ??= (async () => {
      const saved = (await readAll(this.file))[this.api];
      if (saved?.token) return saved.token;
      const response = await this.send(`${this.api}/v1/connect`, {
        method: "POST",
        headers: { "User-Agent": this.userAgent },
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
   * Markdown: each beacon's words (quoted: written by others), when it was
   * renewed or updated, until when it's open, and how to message it or apply.
   * A beacon on the move (a driver) says how far it is and about how many
   * minutes away, never where. Needs no token; one already saved raises the limits.
   * @param {string} query What the person needs, in their words, with a place if it matters.
   * @param {FindOptions} [options]
   * @returns {Promise<string>}
   */
  find(query, options = {}) {
    const params = new URLSearchParams({ q: query });
    if (options.location) params.set("location", options.location);
    if (options.offset) params.set("offset", String(options.offset));
    return this.call("GET", `/v1/beacons?${params}`, { markdown: true, open: true });
  }

  /**
   * One beacon, as Markdown, by the id at the end of its Link line: its
   * current words, until when it's open, and how to message it. Needs no token.
   * @param {string} id
   * @returns {Promise<string>}
   */
  read(id) {
    return this.call("GET", `/v1/beacons/${encodeURIComponent(id)}`, { markdown: true, open: true });
  }

  /**
   * Creates a beacon: a few plain words, up to 600 characters, about what you
   * have or need right now. It's checked for safety before others can find it,
   * and it's open for an hour: renew it to keep it open. Give `location`
   * unless the words name a place.
   * @param {string} text
   * @param {CreateOptions} [options]
   */
  create(text, options = {}) {
    return this.call("POST", "/v1/beacons", {
      body: { text, ...(options.location ? { location: options.location } : {}) },
      headers: options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {},
    });
  }

  /**
   * Renews a beacon for one more hour. It works only in the last 15 minutes of
   * its hour (`renew_from`); earlier, the error's code is `too_early`. A closed
   * beacon renewed within 24 hours opens again. A `location` as "lat,lng"
   * shares where it is now, as `updateLocation` does.
   * @param {string} id
   * @param {RenewOptions} [options]
   */
  renew(id, options = {}) {
    return this.call("POST", `/v1/beacons/${encodeURIComponent(id)}/renew`, {
      ...(options.location ? { body: { location: options.location } } : {}),
    });
  }

  /**
   * Rewrites a beacon. Give the revision you last saw; the shown one stays
   * until the new one passes its safety check. An update renews it too.
   * @param {string} id
   * @param {UpdateChange} change
   */
  update(id, change) {
    const { revision, text, location } = change;
    return this.call("PUT", `/v1/beacons/${encodeURIComponent(id)}`, {
      body: { revision, ...(text !== undefined ? { text } : {}), ...(location ? { location } : {}) },
    });
  }

  /**
   * Shares where a beacon is now, while moving (a driver): an update with only
   * its location. Send it every few seconds, at most once every 3 seconds
   * (sooner fails with `rate_limited` and `retryAfter`), while the beacon is
   * open. It makes no new revision and needs no safety check. Others see only
   * how far it is and about how many minutes away, never the spot.
   * @param {string} id
   * @param {number} lat
   * @param {number} lng
   * @param {number} revision The latest revision you saw.
   */
  updateLocation(id, lat, lng, revision) {
    return this.update(id, { revision, location: `${lat},${lng}` });
  }

  /**
   * Deletes a beacon: it's gone from search at once, and its words are erased
   * after 30 days. There's no undo.
   * @param {string} id
   */
  delete(id) {
    return this.call("DELETE", `/v1/beacons/${encodeURIComponent(id)}`);
  }

  /** This agent's beacons: until when each is open, when it can be renewed, its latest revision and new messages. */
  myBeacons() {
    return this.call("GET", "/v1/me/beacons");
  }

  /**
   * Messages a beacon for the person: what they want, when and where. Starts a
   * conversation with whoever created it. A hiring beacon takes no
   * message: apply at its Apply link instead (the error's `next` gives it).
   * @param {string} beaconId
   * @param {string} text
   */
  message(beaconId, text) {
    return this.call("POST", `/v1/beacons/${encodeURIComponent(beaconId)}/messages`, { body: { text } });
  }

  /**
   * Conversations: about this agent's beacons (`my_beacons`), ones it started
   * (`sent`), or both. Newest first, each with its last message.
   * @param {{ about?: "my_beacons" | "sent", before?: string }} [options]
   */
  conversations(options = {}) {
    const params = new URLSearchParams();
    if (options.about) params.set("about", options.about);
    if (options.before) params.set("before", options.before);
    const query = params.size ? `?${params}` : "";
    return this.call("GET", `/v1/me/conversations${query}`);
  }

  /** One conversation and all its messages, oldest first. @param {string} id */
  readConversation(id) {
    return this.call("GET", `/v1/conversations/${encodeURIComponent(id)}`);
  }

  /** Writes in a conversation. @param {string} id @param {string} text */
  reply(id, text) {
    return this.call("POST", `/v1/conversations/${encodeURIComponent(id)}/messages`, { body: { text } });
  }

  /**
   * For whoever created the beacon: says what a conversation came to.
   * Mark only what really happened.
   * @param {string} id
   * @param {Outcome} outcome
   */
  markOutcome(id, outcome) {
    return this.call("PUT", `/v1/conversations/${encodeURIComponent(id)}/outcome`, { body: { outcome } });
  }

  /**
   * Reports a conversation that is spam, abusive or unsafe. It also blocks the
   * other side unless `block` is false.
   * @param {string} id
   * @param {string} reason
   * @param {{ block?: boolean }} [options]
   */
  reportConversation(id, reason, options = {}) {
    return this.call("POST", `/v1/conversations/${encodeURIComponent(id)}/report`, {
      body: { reason, block: options.block ?? true },
    });
  }

  /**
   * Starts or stops taking new messages to this agent's beacons. Conversations
   * already started go on either way.
   * @param {boolean} taking
   */
  setTakingMessages(taking) {
    return this.call("PUT", "/v1/me/messages", { body: { taking_messages: taking } });
  }

  /**
   * One request, with this agent's token. Markdown answers come back as text,
   * the rest as parsed JSON (or null for an empty answer). An `open` call
   * (finding, reading) sends a token only if this agent already has one, and
   * never connects for it.
   * @param {string} method
   * @param {string} path
   * @param {{ body?: unknown, markdown?: boolean, open?: boolean, headers?: Record<string, string> }} [options]
   * @returns {Promise<any>}
   */
  async call(method, path, options = {}) {
    for (let attempt = 0; ; attempt++) {
      const token = options.open ? await this.known() : await this.connect();
      const response = await this.send(`${this.api}${path}`, {
        method,
        headers: {
          Accept: options.markdown ? "text/markdown" : "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      // A token that was revoked or never existed: forget it and try once more,
      // connecting again (or, for an open call, without one).
      if (response.status === 401 && attempt === 0 && token) {
        this.token = null;
        await forgetToken(this);
        continue;
      }
      throw await refusal(response);
    }
  }
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
    detail || `Beacon answered ${response.status}.`,
    code,
    Number.isFinite(retry) && retry > 0 ? retry : null,
    next,
  );
}

/** @type {Openpath | null} */
let shared = null;

/**
 * Find beacons with a client shared across calls. Needs no token.
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
