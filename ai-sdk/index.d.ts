import type { Openpath, OpenpathOptions, SearchOptions } from "@openpath/sdk";
import type { Tool } from "ai";

export interface OpenpathToolOptions extends Pick<OpenpathOptions, "app" | "token" | "saveToken" | "apiUrl"> {
  /** A client to use instead of a new one, such as one shared with your own code. */
  client?: Openpath;
}

export interface SearchListingsInput {
  /** What the person is looking for, in their words, with a place. */
  query: string;
  /** A place ("Austin, TX", "78701") or "lat,lng". Overrides a place in the query. */
  near?: string;
  /** Only one kind of listing. Read from the query when left out. */
  domain?: SearchOptions["domain"];
}

/** Search Openpath for live listings. Returns plain Markdown. */
export declare function searchListings(options?: OpenpathToolOptions): Tool<SearchListingsInput, string>;
/** Read one Openpath listing in full, by its id. Returns plain Markdown. */
export declare function readListing(options?: OpenpathToolOptions): Tool<{ id: string }, string>;
/** Both tools, sharing one client. */
export declare function openpathTools(options?: OpenpathToolOptions): {
  searchListings: Tool<SearchListingsInput, string>;
  readListing: Tool<{ id: string }, string>;
};
