// Openpath's tools for the Vercel AI SDK: live listings, as
// tools a model can call. Each returns plain Markdown from @openpath/sdk, which
// connects to Openpath by itself the first time: no key and no sign-up.

import { Openpath } from "@openpath/sdk";
import { tool } from "ai";
import { z } from "zod";

const CATEGORIES = /** @type {const} */ (["jobs", "businesses"]);

/**
 * @typedef {{ app?: string, token?: string, saveToken?: boolean, apiUrl?: string, client?: Openpath }} OpenpathToolOptions
 */

/** @param {OpenpathToolOptions} options */
function clientFor(options) {
  if (options.client) return options.client;
  const { app, token, saveToken, apiUrl } = options;
  return new Openpath({ app, token, saveToken, apiUrl });
}

/**
 * Search Openpath: jobs and local businesses in Austin, Texas and nearby towns,
 * plus remote jobs.
 * @param {OpenpathToolOptions} [options]
 */
export function searchListings(options = {}) {
  const openpath = clientFor(options);
  return tool({
    description:
      "Jobs and local businesses in Austin, Texas and nearby towns (Round Rock, Cedar Park, Georgetown), plus remote jobs. Use this when the person wants a job to apply to (barista, nurse, warehouse, software, remote data roles) or a local business to reach (plumber, electrician, dentist, gym, daycare, restaurant). Each result is one current listing: the role or business, the pay when stated, the place, and the employer's Apply link or the owner's Openpath inbox. Write the query as the person said it, with place and pay: \"plumber near Austin, TX\". Not for news, reviews, or places outside the Austin area.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(300)
        .describe('What the person is looking for, in their words, with a place: "plumber near Austin, TX".'),
      near: z
        .string()
        .optional()
        .describe('A place ("Austin, TX", "78701") or "lat,lng". Overrides a place in the query.'),
      category: z.enum(CATEGORIES).optional().describe("Only one kind of listing. Read from the query when left out."),
      offset: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("Where the page starts: 10 results a page, up to 100. A result page's Next page line gives it."),
    }),
    execute: ({ query, near, category, offset }) => openpath.search(query, { near, category, offset }),
  });
}

/**
 * Read one Openpath listing in full.
 * @param {OpenpathToolOptions} [options]
 */
export function readListing(options = {}) {
  const openpath = clientFor(options);
  return tool({
    description:
      "Read one Openpath listing in full, as Markdown, by the id at the end of a result's Link line. Use it to re-read a result before acting on it.",
    inputSchema: z.object({ id: z.string().min(1).describe("The listing id.") }),
    execute: ({ id }) => openpath.getListing(id),
  });
}

/**
 * Both tools, sharing one client.
 * @param {OpenpathToolOptions} [options]
 */
export function openpathTools(options = {}) {
  const shared = { ...options, client: clientFor(options) };
  return { searchListings: searchListings(shared), readListing: readListing(shared) };
}
