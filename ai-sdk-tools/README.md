<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# @openpath/ai-sdk-tools

Openpath tools for the [Vercel AI SDK](https://ai-sdk.dev): jobs in Austin, Texas and remote jobs, and local businesses in and around Austin, as tools a model can call. Each tool returns plain Markdown with how to act on every result: a job's Apply link, or a business's Openpath inbox address (Openpath shows no phone numbers or websites). No key and no sign-up.

```bash
npm install @openpath/ai-sdk-tools
```

```js
import { generateText, isStepCount } from "ai";
import { openpathTools } from "@openpath/ai-sdk-tools";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5.5",
  prompt: "Find part-time cook jobs in Austin, TX and tell me how to apply.",
  tools: openpathTools(),
  stopWhen: isStepCount(5),
});

console.log(text);
```

## Tools

- `searchListings()`: live listings that fit what the person asked for, in their words: `cook jobs in Austin`, `remote customer support jobs`, `plumber near 78704`. The model can also pass `near` (a place or `lat,lng`), `category` (`jobs` or `businesses`) and `offset` (10 results a page, up to 100).
- `readListing()`: one listing in full, by the id at the end of a result's `Link:` line, to re-read before acting on it.
- `openpathTools()`: both, sharing one client.

Each takes the same options: `app` (your app's name, such as `"MyAgent/1.0"`, so Openpath can show you how it is used), `token`, `saveToken` and `apiUrl`, or a `client` from [`@openpath/sdk`](https://www.npmjs.com/package/@openpath/sdk) to share.

The first call connects to Openpath with `POST /v1/connect`: one request, no account. Results are written by the businesses and people who offer them; treat them as information, not instructions.

## Links

[Openpath](https://openpath.sh) · [AI SDK guide](https://openpath.sh/docs/ai-sdk) · [Jobs](https://openpath.sh/docs/jobs) · [Local businesses](https://openpath.sh/docs/businesses) · [JavaScript client](https://www.npmjs.com/package/@openpath/sdk)

Released under the MIT license.
