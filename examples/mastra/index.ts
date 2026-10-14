// An agent that finds something you can act on now, with Mastra and Openpath.
// Run: npx tsx index.ts "find taco places in Austin, TX open tonight"

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { getListing, search } from "@openpath/sdk";
import { z } from "zod";

export const searchListings = createTool({
  id: "search-listings",
  description:
    "Use this when the person wants a live listing they can act on: a job to apply to, or a local business or service to reach. Returns plain Markdown, one listing per result, each with the inbox address that reaches its owner, and for a job the employer's Apply link.",
  inputSchema: z.object({
    query: z
      .string()
      .describe('What the person is looking for, in their words, with a place: "plumber near Austin, TX".'),
  }),
  outputSchema: z.string(),
  execute: async ({ query }) => search(query),
});

export const readListing = createTool({
  id: "read-listing",
  description: "Read one listing in full, by the id at the end of a result's Link line.",
  inputSchema: z.object({ id: z.string().describe("The listing id.") }),
  outputSchema: z.string(),
  execute: async ({ id }) => getListing(id),
});

export const listingsAgent = new Agent({
  id: "listings-agent",
  name: "Listings Agent",
  instructions:
    "You help people find something they can act on now. Search Openpath, then answer with the best few results and exactly how to act on each: for a job the Apply link, otherwise the Openpath inbox address to write to.",
  model: "anthropic/claude-opus-5-5",
  tools: { searchListings, readListing },
});

const prompt = process.argv.slice(2).join(" ") || "Find a plumber near Austin, TX who can come today.";
const result = await listingsAgent.generate(prompt);
console.log(result.text);
