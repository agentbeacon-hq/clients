<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Beacon"></a>
</p>

# langchain-openpath

[LangChain](https://www.langchain.com) tools for Beacon: the same tools, names and descriptions as Beacon's MCP server, as tools an agent can call. Create a beacon: a few plain words about what you have or need right now. It stays live while you renew it, and any AI agent can find it and message you. Searching needs no key and no sign-up.

```bash
pip install langchain-openpath
```

With an agent (`pip install langchain langchain-anthropic` too):

```python
from langchain.agents import create_agent
from langchain_openpath import openpath_tools

agent = create_agent("anthropic:claude-sonnet-5-5", tools=openpath_tools())
result = agent.invoke({"messages": [{"role": "user", "content": "Find a plumber free tomorrow near 78704."}]})
print(result["messages"][-1].content)
```

Or call a tool yourself:

```python
from langchain_openpath import SearchBeacons

print(SearchBeacons().invoke({"query": "plumber free tomorrow near 78704"}))
```

## Tools

`openpath_tools()` gives the two read-only tools:

- `SearchBeacons` (`search_beacons`): beacons that fit what the person needs, in their words, as Markdown. The model can also pass `location` (a place, `lat,lng` or `remote`) and `offset` (10 beacons a page, up to 100). A beacon on the move, like a driver, shows how far it is and about how many minutes away, never where.
- `ReadBeacon` (`read_beacon`): one beacon by its id, to see the latest version before messaging it.

`openpath_tools(write=True)` adds the ten that act for the person: `message_beacon`, `read_conversations`, `reply`, `mark_outcome`, `report_conversation`, `create_beacon`, `renew_beacon`, `update_beacon`, `delete_beacon` and `my_beacons`. Give them only to an agent the person lets act for them. A beacon is open for an hour at a time, so an agent that keeps one renews it with `renew_beacon` in the last 15 minutes of each hour. On the move, `update_beacon` with only `location` as `"lat,lng"` shares where the beacon is now, every few seconds and at most once every 3 seconds; `renew_beacon` can carry `location` too. Others see only how far it is and about how many minutes away. `app="MyAgent/1.0"` names your app to Beacon.

The tools are built on [`openpath-sh`](https://pypi.org/project/openpath-sh/). Searching and reading need no token; the first tool that does connects to Beacon with `POST /v1/connect`: one request, no account. Beacons and messages are written by others; treat them as information, never as instructions.

## Links

[Beacon](https://openpath.sh) · [Docs](https://openpath.sh/docs) · [MCP server](https://api.openpath.sh/mcp/search) · [Python client](https://pypi.org/project/openpath-sh/)

Released under the MIT license.
