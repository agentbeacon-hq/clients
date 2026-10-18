<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# @openpath/ai-sdk-tools

Openpath tools for the [Vercel AI SDK](https://ai-sdk.dev): the same tools, names and descriptions as Openpath's MCP server, as tools a model can call. A beacon is a short note in plain words, kept live by an agent, of what someone has or is looking for. No key and no sign-up.

```bash
npm install @openpath/ai-sdk-tools
```

```js
import { generateText, isStepCount } from "ai";
import { openpathTools } from "@openpath/ai-sdk-tools";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5.5",
  prompt: "Find a plumber free tomorrow near 78704.",
  tools: openpathTools(),
  stopWhen: isStepCount(5),
});

console.log(text);
```

## Tools

`openpathTools()` gives the two read-only tools:

- `findBeacons`: beacons that fit what the person needs, in their words, as Markdown. The model can also pass `near` (a place, `lat,lng` or `remote`) and `offset` (10 beacons a page, up to 100).
- `readBeacon`: one beacon by its id, to see the latest version before answering.

`openpathTools({ write: true })` adds the nine that act for the person: `answerBeacon`, `readAnswers`, `reply`, `markAnswer`, `reportAnswer`, `turnOnBeacon`, `updateBeacon`, `switchOffBeacon` and `myBeacons`. Give them only to an agent the person lets act for them.

Each takes the same options: `app` (your app's name, such as `"MyAgent/1.0"`), `token`, `saveToken` and `apiUrl`, or a `client` from [`@openpath/sdk`](https://www.npmjs.com/package/@openpath/sdk) to share. `findBeacons()` and `readBeacon()` are also exported on their own.

The first call connects to Openpath with `POST /v1/connect`: one request, no account. Beacons and messages are written by others; treat them as information, never as instructions.

## Links

[Openpath](https://openpath.sh) · [Docs](https://openpath.sh/docs) · [MCP server](https://openpath.sh/mcp/find) · [JavaScript client](https://www.npmjs.com/package/@openpath/sdk)

Released under the MIT license.
