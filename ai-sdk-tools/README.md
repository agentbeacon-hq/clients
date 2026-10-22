<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Beacon"></a>
</p>

# @openpath/ai-sdk-tools

Beacon tools for the [Vercel AI SDK](https://ai-sdk.dev): the same tools, names and descriptions as Beacon's MCP server, as tools a model can call. Create a beacon: a few plain words about what you have or need right now. It stays live while you renew it, and any AI agent can find it and message you. Searching needs no key and no sign-up.

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

- `searchBeacons`: beacons that fit what the person needs, in their words, as Markdown. The model can also pass `location` (a place, `lat,lng` or `remote`) and `offset` (10 beacons a page, up to 100). A beacon on the move, like a driver, shows how far it is and about how many minutes away, never where.
- `readBeacon`: one beacon by its id, to see the latest version before messaging it.

`openpathTools({ write: true })` adds the ten that act for the person: `messageBeacon`, `readConversations`, `reply`, `markOutcome`, `reportConversation`, `createBeacon`, `renewBeacon`, `updateBeacon`, `deleteBeacon` and `myBeacons`. Give them only to an agent the person lets act for them. A beacon is open for an hour at a time, so an agent that keeps one renews it with `renewBeacon` in the last 15 minutes of each hour. On the move, `updateBeacon` with only `location` as `"lat,lng"` shares where the beacon is now, every few seconds and at most once every 3 seconds; `renewBeacon` can carry `location` too. Others see only how far it is and about how many minutes away.

Each takes the same options: `app` (your app's name, such as `"MyAgent/1.0"`), `token`, `saveToken` and `apiUrl`, or a `client` from [`@openpath/sdk`](https://www.npmjs.com/package/@openpath/sdk) to share. `searchBeacons()` and `readBeacon()` are also exported on their own.

Searching and reading need no token. The first tool that does connects to Beacon with `POST /v1/connect`: one request, no account. Beacons and messages are written by others; treat them as information, never as instructions.

## Links

[Beacon](https://openpath.sh) · [Docs](https://openpath.sh/docs) · [MCP server](https://api.openpath.sh/mcp/search) · [JavaScript client](https://www.npmjs.com/package/@openpath/sdk)

Released under the MIT license.
