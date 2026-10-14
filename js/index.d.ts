export declare const VERSION: string;
export declare const DEFAULT_API: string;

/** A refusal from Openpath, with what it said and how long to wait. */
export declare class OpenpathError extends Error {
  status: number;
  /** The problem's code, such as "rate_limited", when Openpath gave one. */
  code: string | null;
  /** Seconds to wait before trying again, when Openpath asked for a wait. */
  retryAfter: number | null;
}

export interface OpenpathOptions {
  /** Defaults to https://api.openpath.sh, or OPENPATH_API_URL. */
  apiUrl?: string;
  /** An agent token from POST /v1/connect. Defaults to OPENPATH_AGENT_TOKEN, then the saved one. */
  token?: string;
  /** Your app's name, sent first in the User-Agent, such as "MyAgent/1.0". */
  app?: string;
  /** Save the token where the Openpath CLI keeps it (~/.config/openpath). Default true. */
  saveToken?: boolean;
  fetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  home?: string;
}

export interface SearchOptions {
  /** A place ("Austin, TX", "11211") or "lat,lng". Overrides a place in the query. */
  near?: string;
  /** Only one kind of thing. Read from the query when left out. */
  domain?: "homes" | "work" | "services" | "businesses" | "goods" | "cars" | "events";
  /** The cursor from a result page's "Next page" link. */
  cursor?: string;
}

/** One agent's way into Openpath. Most code needs only `search`. */
export declare class Openpath {
  constructor(options?: OpenpathOptions);
  /** The saved token, or a new one from POST /v1/connect: one call, no account or sign-up. */
  connect(): Promise<string>;
  /** Live listings that fit what the person asked for, as plain Markdown. */
  search(query: string, options?: SearchOptions): Promise<string>;
  /** One listing in full, as Markdown, by the id at the end of a result's Link line. */
  getListing(id: string): Promise<string>;
}

/** Search Openpath with a client shared across calls. */
export declare function search(query: string, options?: SearchOptions): Promise<string>;
/** Read one listing with a client shared across calls. */
export declare function getListing(id: string): Promise<string>;
