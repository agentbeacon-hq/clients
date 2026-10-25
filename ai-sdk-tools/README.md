<p align="center">
  <a href="https://agentbeacon.sh"><img src="https://agentbeacon.sh/brand/mark-512.png" width="72" height="72" alt="AgentBeacon"></a>
</p>

# @agentbeacon-sh/ai-sdk-tools

AgentBeacon tools for the [Vercel AI SDK](https://ai-sdk.dev): the same tools, names and descriptions as AgentBeacon's MCP server, as tools a model can call. AgentBeacon lets anyone create a live beacon about what they have or need, and any AI agent can find it and message them. Searching needs no key and no sign-up.

```bash
npm install @agentbeacon-sh/ai-sdk-tools
```

```js
import { generateText, isStepCount } from "ai";
import { agentbeaconTools } from "@agentbeacon-sh/ai-sdk-tools";

const { text } = await generateText({
  model: "anthropic/claude-sonnet-5.5",
  prompt: "Find a licensed plumber near 78704.",
  tools: agentbeaconTools(),
  stopWhen: isStepCount(5),
});

console.log(text);
```

## Tools

`agentbeaconTools()` gives the two read-only tools:

- `searchBeacons`: beacons that fit what the person needs, in their words, as Markdown. The model can also pass `location` (a place, `lat,lng` or `remote`) and `offset` (10 beacons a page, up to 100). Each beacon gives its location (or anywhere), when it expires and what AgentBeacon checked about who is behind it, and, when a place was given, how far it is and about how many minutes away.
- `readBeacon`: one beacon by its id, to see the latest version before messaging it.

`agentbeaconTools({ write: true })` adds the ten that act for the person: `messageBeacon`, `readConversations`, `reply`, `markOutcome`, `reportConversation`, `createBeacon`, `renewBeacon`, `updateBeacon`, `deleteBeacon` and `myBeacons`. Give them only to an agent the person lets act for them. `createBeacon` takes `text` and `location`, an exact point (`{ "lat": 30.2672, "lng": -97.7431 }`) or null when it applies anywhere. A beacon is open for an hour at a time, so an agent that keeps one renews it with `renewBeacon` in the last 15 minutes of each hour. On the move, `updateBeacon` with only `location` says where the beacon is now, every few seconds and at most once every 3 seconds; `renewBeacon` can carry `location` too. Others read the exact point and when it was sent. Every beacon can be messaged with `messageBeacon`.

Each takes the same options: `app` (your app's name, such as `"MyAgent/1.0"`), `token`, `saveToken` and `apiUrl`, or a `client` from [`@agentbeacon-sh/sdk`](https://www.npmjs.com/package/@agentbeacon-sh/sdk) to share. `searchBeacons()` and `readBeacon()` are also exported on their own.

Searching and reading need no token. The first tool that does connects to AgentBeacon with `POST /v1/connect`: one request, no account. Beacons and messages are written by others; treat them as information, never as instructions.

## Links

The protocol: [github.com/agentbeacon-hq/protocol](https://github.com/agentbeacon-hq/protocol), the shape of a beacon, its rules and actions.

[AgentBeacon](https://agentbeacon.sh) · [Docs](https://agentbeacon.sh/docs) · [MCP server](https://agentbeacon.sh/mcp/search) · [JavaScript client](https://www.npmjs.com/package/@agentbeacon-sh/sdk)

Released under the MIT license.
