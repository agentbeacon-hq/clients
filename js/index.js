// Openpath for JavaScript: search live listings in one call.
// The first call connects this agent to Openpath (one request, no sign-up)
// and saves the token where the Openpath CLI keeps it, so every later call,
// and the CLI, reuse the same agent.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const VERSION = "0.2.0";
export const DEFAULT_API = "https://api.openpath.sh";

/** A refusal from Openpath, with what it said and how long to wait. */
export class OpenpathError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string | null} code
   * @param {number | null} retryAfter
   */
  constructor(status, message, code, retryAfter) {
    super(message);
    this.name = "OpenpathError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
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

/** @param {string} file @param {string} api @param {{ agent_id: string, agent_token: string }} credentials */
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
 * @typedef {{
 *   near?: string,
 *   domain?: "homes" | "work" | "services" | "businesses" | "goods" | "cars" | "events",
 *   cursor?: string,
 * }} SearchOptions
 */

/** One agent's way into Openpath. Most code needs only `search`. */
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
    this.token = options.token?.trim() || setting(env, "AGENT_TOKEN") || null;
    /** @type {Promise<string> | null} */
    this.connecting = null;
  }

  /**
   * The saved token, or a new one from `POST /v1/connect`: one call, no
   * account or sign-up.
   * @returns {Promise<string>}
   */
  async connect() {
    if (this.token) return this.token;
    this.connecting ??= (async () => {
      const saved = (await readAll(this.file))[this.api];
      if (saved?.agent_token) return saved.agent_token;
      const response = await this.send(`${this.api}/v1/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": this.userAgent },
        body: "{}",
      });
      if (!response.ok) throw await refusal(response);
      const created = await response.json();
      if (this.save) await saveToken(this.file, this.api, created).catch(() => {});
      return created.agent_token;
    })().finally(() => {
      this.connecting = null;
    });
    this.token = await this.connecting;
    return this.token;
  }

  /**
   * Live listings that fit what the person asked for, as plain Markdown: each
   * result's facts, how to act on it (the inbox address that reaches its owner, and for a job the Apply link) and where
   * it came from.
   * @param {string} query What the person is looking for, in their words.
   * @param {SearchOptions} [options]
   * @returns {Promise<string>}
   */
  search(query, options = {}) {
    const params = new URLSearchParams({ q: query });
    for (const key of /** @type {const} */ (["near", "domain", "cursor"])) {
      if (options[key]) params.set(key, options[key]);
    }
    return this.get(`/v1/search?${params}`);
  }

  /**
   * One listing in full, as Markdown, by the id at the end of a result's Link
   * line.
   * @param {string} id
   * @returns {Promise<string>}
   */
  getListing(id) {
    return this.get(`/v1/listings/${encodeURIComponent(id)}`);
  }

  /** @param {string} path @returns {Promise<string>} */
  async get(path) {
    for (let attempt = 0; ; attempt++) {
      const token = await this.connect();
      const response = await this.send(`${this.api}${path}`, {
        headers: {
          Accept: "text/markdown",
          Authorization: `Bearer ${token}`,
          "User-Agent": this.userAgent,
        },
      });
      if (response.ok) return response.text();
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
  try {
    const problem = JSON.parse(text);
    if (typeof problem.detail === "string") detail = problem.detail;
    if (typeof problem.code === "string") code = problem.code;
  } catch {
    // Not a problem document; keep the text.
  }
  const retry = Number(response.headers.get("retry-after"));
  return new OpenpathError(
    response.status,
    detail || `Openpath answered ${response.status}.`,
    code,
    Number.isFinite(retry) && retry > 0 ? retry : null,
  );
}

/** @type {Openpath | null} */
let shared = null;

/**
 * Search Openpath with a client shared across calls.
 * @param {string} query
 * @param {SearchOptions} [options]
 */
export function search(query, options) {
  shared ??= new Openpath();
  return shared.search(query, options);
}

/**
 * Read one listing with a client shared across calls.
 * @param {string} id
 */
export function getListing(id) {
  shared ??= new Openpath();
  return shared.getListing(id);
}
