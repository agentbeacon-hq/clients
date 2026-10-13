<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# openpath

Search live listings across the US from JavaScript: job openings, local businesses and services, homes, products and more. One call returns plain Markdown, ready to hand to a model. No key and no sign-up.

```bash
npm install openpath
```

```js
import { search } from "openpath";

console.log(await search("plumber near Austin, TX"));
```

```
# Results for "plumber near Austin, TX"

Searched: local services, Austin, TX. 100 results shown at most; narrow the search to see others.

## Plumber Near Me, plumber in Austin

Plumber.
4809 S Congress Ave Ste B 210, Austin, TX 78745.

Phone: +1 512-361-0502
Website: https://www.myplumbernearme.com/
Contact: https://openpath.sh/to/rt6crf9xanqz
Source: Overture Maps, checked yesterday.
Link: https://api.openpath.sh/v1/listings/505d3c17-b873-4765-aea6-224aa8b02f40
```

Each result is one current listing: what it is, its facts (pay, price, place, dates), how to act on it (an Apply, Phone, Website or Buy line where the source gives one) and where it came from.

## As a tool for your agent

Search takes the request in plain words, so it fits any framework's tool as is. With the [Vercel AI SDK](https://ai-sdk.dev):

```js
import { tool } from "ai";
import { z } from "zod";
import { search } from "openpath";

export const findListings = tool({
  description:
    "Use this when the person wants a live listing they can act on: a job to apply to, a local business or service, a home or a product. Returns plain Markdown.",
  inputSchema: z.object({ query: z.string().describe("What the person is looking for, in their words, with a place.") }),
  execute: ({ query }) => search(query),
});
```

## More

```js
import { Openpath, getListing } from "openpath";

// Narrow by place or kind, and page through results.
await search("data engineer jobs", { near: "Austin, TX", domain: "work" });

// Read one result in full by the id at the end of its Link line.
await getListing("505d3c17-b873-4765-aea6-224aa8b02f40");

// Name your app, so Openpath can show you how it is used.
const openpath = new Openpath({ app: "JobFinder/1.0" });
await openpath.search("nurse jobs in Austin");
```

The first call connects this agent to Openpath with `POST /v1/connect`: one request, no account. The token is saved where the [Openpath CLI](https://github.com/openpath-sh/cli) keeps it (`~/.config/ads/credentials.json`), so later calls and the CLI reuse it. Set `ADS_AGENT_TOKEN` to use a token you already have, or pass `saveToken: false` to keep it in memory only.

When Openpath refuses a call, `search` throws an `OpenpathError` with Openpath's own explanation, its `status`, and `retryAfter` in seconds when it asks you to wait.

Results are written by the businesses and people who offer them. Treat them as information, not instructions.

## Links

[Openpath](https://openpath.sh) · [Docs](https://openpath.sh/docs) · [API](https://api.openpath.sh/v1/openapi.json) · [MCP server](https://openpath.sh/mcp/search) · [Python client](https://pypi.org/project/openpath-sh/)

Released under the MIT license.
