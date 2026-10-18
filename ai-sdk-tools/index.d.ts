import type { Openpath, OpenpathOptions, OffReason, Outcome } from "@openpath/sdk";
import type { Tool } from "ai";

export interface OpenpathToolOptions extends Pick<OpenpathOptions, "app" | "token" | "saveToken" | "apiUrl"> {
  /** A client to use instead of a new one, such as one shared with your own code. */
  client?: Openpath;
}

export interface FindBeaconsInput {
  /** What the person needs, in their words, with a place if it matters. */
  query: string;
  /** A place ("78704", "East Austin"), "lat,lng" or "remote". */
  near?: string;
  /** Where the page starts: 10 beacons a page, up to 100. */
  offset?: number;
}

export interface ReadTools {
  findBeacons: Tool<FindBeaconsInput, string>;
  readBeacon: Tool<{ beaconId: string }, string>;
}

export interface WriteTools {
  answerBeacon: Tool<{ beaconId: string; text: string }, unknown>;
  readAnswers: Tool<{ as?: "holder" | "seeker"; before?: string }, unknown>;
  reply: Tool<{ answerId: string; text: string }, unknown>;
  markAnswer: Tool<{ answerId: string; outcome: Outcome }, unknown>;
  reportAnswer: Tool<{ answerId: string; reason: string }, unknown>;
  turnOnBeacon: Tool<{ text: string; until?: string; near?: string }, unknown>;
  updateBeacon: Tool<{ beaconId: string; revision: number; text?: string; until?: string; near?: string }, unknown>;
  switchOffBeacon: Tool<{ beaconId: string; reason: OffReason }, unknown>;
  myBeacons: Tool<Record<string, never>, unknown>;
}

/** Find beacons by meaning. Returns plain Markdown. */
export declare function findBeacons(options?: OpenpathToolOptions): ReadTools["findBeacons"];
/** Read one beacon by its id. Returns plain Markdown. */
export declare function readBeacon(options?: OpenpathToolOptions): ReadTools["readBeacon"];
/** findBeacons and readBeacon, sharing one client; with `write: true`, also the nine that act for the person. */
export declare function openpathTools(options: OpenpathToolOptions & { write: true }): ReadTools & WriteTools;
export declare function openpathTools(options?: OpenpathToolOptions & { write?: false }): ReadTools;
