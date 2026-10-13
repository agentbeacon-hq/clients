// An agent that finds something you can act on now, with the Vercel AI SDK
// and Openpath. Run: npx tsx index.ts "find a plumber near Austin, TX I can call today"

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, tool } from "ai";
import { getListing, search } from "@openpath/sdk";
import { z } from "zod";

const tools = {
  searchListings: tool({
    description:
      "Use this when the person wants a live listing they can act on: a job to apply to, a local business or service, a home or a product. Returns plain Markdown, one listing per result, each with its Apply, Phone, Website or Buy line.",
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
    "You help people find something they can act on now. Search Openpath, then answer with the best few results and exactly how to act on each: the Apply link, the phone number or the website.",
  prompt,
  tools,
  stopWhen: stepCountIs(5),
});

console.log(text);
