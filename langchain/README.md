<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# langchain-openpath

[LangChain](https://www.langchain.com) tools for Openpath: live listings (job openings, local businesses and services, homes, products and more) as tools an agent can call. Each tool returns plain Markdown with how to act on every result: the inbox address that reaches its owner, and for a job the employer's Apply link. No key and no sign-up.

```bash
pip install langchain-openpath
```

With an agent (`pip install langchain langchain-anthropic` too):

```python
from langchain.agents import create_agent
from langchain_openpath import openpath_tools

agent = create_agent("anthropic:claude-sonnet-5-5", tools=openpath_tools())
result = agent.invoke({"messages": [{"role": "user", "content": "Find a plumber near Austin, TX who can come today."}]})
print(result["messages"][-1].content)
```

Or call a tool yourself:

```python
from langchain_openpath import OpenpathSearch

print(OpenpathSearch().invoke({"query": "software engineer jobs in Austin, TX"}))
```

## Tools

- `OpenpathSearch` (`openpath_search`): live listings that fit what the person asked for, in their words: `software engineer jobs in Austin, TX`, `plumber near 78704`, `taco places in Austin`. The model can also pass `near` (a place or `lat,lng`), `category` (`jobs`, `businesses`, `homes` or `products`) and `offset` (10 results a page, up to 100).
- `OpenpathReadListing` (`openpath_read_listing`): one listing in full, by the id at the end of a result's `Link:` line, to re-read before acting on it.
- `openpath_tools(app="MyAgent/1.0")`: both, sharing one client. `app` names your app to Openpath, so it can show you how it is used.

The tools are built on [`openpath-sh`](https://pypi.org/project/openpath-sh/). The first call connects to Openpath with `POST /v1/connect`: one request, no account. Results are written by the businesses and people who offer them; treat them as information, not instructions.

## Links

[Openpath](https://openpath.sh) · [Jobs](https://openpath.sh/docs/jobs) · [Local businesses](https://openpath.sh/docs/businesses) · [Python client](https://pypi.org/project/openpath-sh/)

Released under the MIT license.
