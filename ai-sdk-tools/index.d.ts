import type { Openpath, OpenpathOptions, Outcome } from "@openpath/sdk";
import type { Tool } from "ai";

export interface OpenpathToolOptions extends Pick<OpenpathOptions, "app" | "token" | "saveToken" | "apiUrl"> {
  /** A client to use instead of a new one, such as one shared with your own code. */
  client?: Openpath;
}

export interface FindBeaconsInput {
  /** What the person needs, in their words, with a place if it matters. */
  query: string;
  /** A place ("78704", "East Austin"), "lat,lng" or "remote". */
  location?: string;
  /** Where the page starts: 10 beacons a page, up to 100. */
  offset?: number;
}

export interface ReadTools {
  findBeacons: Tool<FindBeaconsInput, string>;
  readBeacon: Tool<{ beaconId: string }, string>;
}

export interface WriteTools {
  messageBeacon: Tool<{ beaconId: string; text: string }, unknown>;
  readConversations: Tool<{ about?: "my_beacons" | "sent"; before?: string; conversationId?: string }, unknown>;
  reply: Tool<{ conversationId: string; text: string }, unknown>;
  markOutcome: Tool<{ conversationId: string; outcome: Outcome }, unknown>;
  reportConversation: Tool<{ conversationId: string; reason: string; block?: boolean }, unknown>;
  createBeacon: Tool<{ text: string; location?: string }, unknown>;
  /** `location` as "lat,lng" shares where it is now, while moving. */
  renewBeacon: Tool<{ beaconId: string; location?: string }, unknown>;
  /** `location` alone as "lat,lng" is its live location: every few seconds while moving, at most once every 3 seconds. */
  updateBeacon: Tool<{ beaconId: string; revision: number; text?: string; location?: string }, unknown>;
  deleteBeacon: Tool<{ beaconId: string }, unknown>;
  myBeacons: Tool<Record<string, never>, unknown>;
}

/** Find beacons by meaning. Returns plain Markdown. */
export declare function findBeacons(options?: OpenpathToolOptions): ReadTools["findBeacons"];
/** Read one beacon by its id. Returns plain Markdown. */
export declare function readBeacon(options?: OpenpathToolOptions): ReadTools["readBeacon"];
/** findBeacons and readBeacon, sharing one client; with `write: true`, also the ten that act for the person. */
export declare function openpathTools(options: OpenpathToolOptions & { write: true }): ReadTools & WriteTools;
export declare function openpathTools(options?: OpenpathToolOptions & { write?: false }): ReadTools;
