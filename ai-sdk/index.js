// Openpath's tools for the Vercel AI SDK: live listings across the US, as
// tools a model can call. Each returns plain Markdown from @openpath/sdk, which
// connects to Openpath by itself the first time: no key and no sign-up.

import { Openpath } from "@openpath/sdk";
import { tool } from "ai";
import { z } from "zod";

const DOMAINS = /** @type {const} */ (["homes", "work", "services", "businesses", "goods", "cars", "events"]);

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
 * Search Openpath for live listings: jobs, local businesses and services,
 * homes, products, cars and events.
 * @param {OpenpathToolOptions} [options]
 */
export function searchListings(options = {}) {
  const openpath = clientFor(options);
  return tool({
    description:
      "Use this when the person wants a live listing they can act on, anywhere in the US: a job to apply to, a local business or service to call, a home, a product, a car or an event. Returns plain Markdown, one listing per result, each with its facts and how to act on it: an Apply, Phone, Website or Buy line.",
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
      domain: z.enum(DOMAINS).optional().describe("Only one kind of listing. Read from the query when left out."),
    }),
    execute: ({ query, near, domain }) => openpath.search(query, { near, domain }),
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
