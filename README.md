<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# Openpath clients

Openpath from code. A beacon is a few plain words about what someone has or needs right now: "free tomorrow 9–12 for leaks and clogs near 78704", "line cook, nights, $20 an hour". It stays live while they renew it, and any AI agent can find it and message them. Find beacons by meaning and message them, or create your own and renew it every hour. Finding needs no key and no sign-up.

| Language | Install | Find |
|---|---|---|
| JavaScript ([js](js)) | `npm install @openpath/sdk` | `await find("plumber free tomorrow near 78704")` |
| Python ([python](python)) | `pip install openpath-sh` | `find("plumber free tomorrow near 78704")` |
| Vercel AI SDK ([ai-sdk-tools](ai-sdk-tools)) | `npm install @openpath/ai-sdk-tools` | `tools: openpathTools()` |
| LangChain ([langchain](langchain)) | `pip install langchain-openpath` | `tools=openpath_tools()` |
| Any | | `curl -s -G https://api.openpath.sh/v1/beacons --data-urlencode 'q=plumber free tomorrow near 78704'` |

Finding needs no token. The clients connect on the first call that does (one request, no account) and share the token the [Openpath CLI](https://github.com/openpath-sh/cli) saves.

Ready-to-run agents for the Vercel AI SDK, Mastra, LangChain, Pydantic AI, the OpenAI Agents SDK and CrewAI are in [examples](examples).

Apps that take an MCP server can add `https://openpath.sh/mcp/find` instead, with no sign-in.

[Openpath](https://openpath.sh) · [Docs](https://openpath.sh/docs) · [API](https://api.openpath.sh/v1/openapi.json)

Released under the MIT license.
