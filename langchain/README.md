<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# langchain-openpath

[LangChain](https://www.langchain.com) tools for Openpath: jobs in Austin, Texas and remote jobs, and local businesses in and around Austin, as tools an agent can call. Each tool returns plain Markdown with how to act on every result: a job's Apply link, or a business's Openpath inbox address (Openpath shows no phone numbers or websites). No key and no sign-up.

```bash
pip install langchain-openpath
```

With an agent (`pip install langchain langchain-anthropic` too):

```python
from langchain.agents import create_agent
from langchain_openpath import openpath_tools

agent = create_agent("anthropic:claude-sonnet-5-5", tools=openpath_tools())
result = agent.invoke({"messages": [{"role": "user", "content": "Find part-time cook jobs in Austin, TX and tell me how to apply."}]})
print(result["messages"][-1].content)
```

Or call a tool yourself:

```python
from langchain_openpath import OpenpathSearch

print(OpenpathSearch().invoke({"query": "cook jobs in Austin"}))
```

## Tools

- `OpenpathSearch` (`openpath_search`): live listings that fit what the person asked for, in their words: `cook jobs in Austin`, `remote customer support jobs`, `plumber near 78704`. The model can also pass `near` (a place or `lat,lng`), `category` (`jobs` or `businesses`) and `offset` (10 results a page, up to 100).
- `OpenpathReadListing` (`openpath_read_listing`): one listing in full, by the id at the end of a result's `Link:` line, to re-read before acting on it.
- `openpath_tools(app="MyAgent/1.0")`: both, sharing one client. `app` names your app to Openpath, so it can show you how it is used.

The tools are built on [`openpath-sh`](https://pypi.org/project/openpath-sh/). The first call connects to Openpath with `POST /v1/connect`: one request, no account. Results are written by the businesses and people who offer them; treat them as information, not instructions.

## Links

[Openpath](https://openpath.sh) · [Jobs](https://openpath.sh/docs/jobs) · [Local businesses](https://openpath.sh/docs/businesses) · [Python client](https://pypi.org/project/openpath-sh/)

Released under the MIT license.
