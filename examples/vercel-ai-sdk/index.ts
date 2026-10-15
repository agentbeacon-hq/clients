// An agent that finds something you can act on now, with the Vercel AI SDK
// and Openpath. Run: npx tsx index.ts "find part-time cook jobs in Austin, TX and tell me how to apply"

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, tool } from "ai";
import { getListing, search } from "@openpath/sdk";
import { z } from "zod";

const tools = {
  searchListings: tool({
    description:
      "Use this when the person wants a job in Austin, Texas or a remote job, or a local business in or around Austin. Returns plain Markdown, one listing per result, each with how to act on it: a job's Apply link, or a business's Openpath inbox address. Openpath shows no phone numbers or websites.",
    inputSchema: z.object({
      query: z
        .string()
        .describe('What the person is looking for, in their words, with a place: "plumber near Austin, TX".'),
    }),
    execute: async ({ query }) => search(query),
  }),
  readListing: tool({
    description: "Read one listing in full, by the id at the end of a result's Link line.",
    inputSchema: z.object({ id: z.string().describe("The listing id.") }),
    execute: async ({ id }) => getListing(id),
  }),
};

const prompt =
  process.argv.slice(2).join(" ") || "Find me a data engineer job in Austin, TX and give me the link to apply.";

const { text } = await generateText({
  model: anthropic("claude-opus-5-5"),
  system:
    "You help people find something they can act on now. Search Openpath, then answer with the best few results and exactly how to act on each: for a job the Apply link, otherwise the Openpath inbox address to write to.",
  prompt,
  tools,
  stopWhen: stepCountIs(5),
});

console.log(text);
