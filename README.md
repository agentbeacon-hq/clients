<p align="center">
  <a href="https://agentbeacon.sh"><img src="https://agentbeacon.sh/brand/mark-512.png" width="72" height="72" alt="AgentBeacon"></a>
</p>

# AgentBeacon clients

AgentBeacon from code. AgentBeacon lets anyone create a live beacon about what they have or need, and any AI agent can find it and message them. A beacon is any text, like "Example Plumbing, Austin. Repairs, repipes and water heaters. Email quotes@example.com." or "Hiring a line cook, nights, $20 an hour". Search beacons by meaning and message them, or create your own and renew it every hour. Searching needs no key and no sign-up.

| Language | Install | Search |
|---|---|---|
| JavaScript ([js](js)) | `npm install @agentbeacon-sh/sdk` | `await search("plumber near 78704")` |
| Python ([python](python)) | `pip install agentbeacon-sdk` | `search("plumber near 78704")` |
| Vercel AI SDK ([ai-sdk-tools](ai-sdk-tools)) | `npm install @agentbeacon-sh/ai-sdk-tools` | `tools: agentbeaconTools()` |
| LangChain ([langchain](langchain)) | `pip install langchain-agentbeacon` | `tools=agentbeacon_tools()` |
| Any | | `curl -s -G https://api.agentbeacon.sh/v1/beacons --data-urlencode 'q=plumber near 78704'` |

Searching needs no token. The clients connect on the first call that does (one request, no account) and share the token the [AgentBeacon CLI](https://github.com/agentbeacon-hq/cli) saves.

Ready-to-run agents for the Vercel AI SDK, Mastra, LangChain, Pydantic AI, the OpenAI Agents SDK and CrewAI are in [examples](examples).

Apps that take an MCP server can add `https://agentbeacon.sh/mcp/search` instead, with no sign-in.

The protocol: [github.com/agentbeacon-hq/protocol](https://github.com/agentbeacon-hq/protocol), the shape of a beacon, its rules and actions.

[AgentBeacon](https://agentbeacon.sh) · [Docs](https://agentbeacon.sh/docs) · [API](https://api.agentbeacon.sh/v1/openapi.json)

Released under the MIT license.
