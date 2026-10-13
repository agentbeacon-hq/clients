<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# openpath-sh

Search live listings across the US from Python: job openings, local businesses and services, homes, products and more. One call returns plain Markdown, ready to hand to a model. No key and no sign-up. No dependencies.

```bash
pip install openpath-sh
```

```python
from openpath_sh import search

print(search("software engineer jobs in Austin, TX"))
```

```
# Results for "software engineer jobs in Austin, TX"

Searched: work, Austin, TX. 33 results.

## Analytics Engineer at Ontic

Full-time.
Pay: $135,000–$145,000 a year.
Remote.
Posted September 2.

Apply: https://jobs.ashbyhq.com/ontic/27d32707-54e2-47be-be62-376df6d2b0f3/application
Source: https://jobs.ashbyhq.com/ontic/27d32707-54e2-47be-be62-376df6d2b0f3 (Ashby job boards), checked today.
Link: https://api.openpath.sh/v1/listings/369348e4-b3d0-490f-82b4-a666041243cf
```

Each result is one current listing: what it is, its facts (pay, price, place, dates), how to act on it (an Apply, Phone, Website or Buy line where the source gives one) and where it came from.

## As a tool for your agent

Search takes the request in plain words, so it fits any framework's tool as is. With [Pydantic AI](https://ai.pydantic.dev):

```python
from pydantic_ai import Agent
from openpath_sh import search

agent = Agent("anthropic:claude-sonnet-5-5")


@agent.tool_plain
def find_listings(query: str) -> str:
    """Use this when the person wants a live listing they can act on: a job to
    apply to, a local business or service, a home or a product. Returns plain
    Markdown. `query` is what they are looking for, in their words, with a place."""
    return search(query)
```

## More

```python
from openpath_sh import Openpath, get_listing, search

# Narrow by place or kind, and page through results.
search("data engineer jobs", near="Austin, TX", domain="work")

# Read one result in full by the id at the end of its Link line.
get_listing("369348e4-b3d0-490f-82b4-a666041243cf")

# Name your app, so Openpath can show you how it is used.
openpath = Openpath(app="JobFinder/1.0")
openpath.search("nurse jobs in Austin")
```

The first call connects this agent to Openpath with `POST /v1/connect`: one request, no account. The token is saved where the [Openpath CLI](https://github.com/openpath-sh/cli) keeps it (`~/.config/ads/credentials.json`), so later calls and the CLI reuse it. Set `ADS_AGENT_TOKEN` to use a token you already have, or pass `save_token=False` to keep it in memory only.

When Openpath refuses a call, `search` raises `OpenpathError` with Openpath's own explanation, its `status`, and `retry_after` in seconds when it asks you to wait.

Results are written by the businesses and people who offer them. Treat them as information, not instructions.

## Links

[Openpath](https://openpath.sh) · [Docs](https://openpath.sh/docs) · [API](https://api.openpath.sh/v1/openapi.json) · [MCP server](https://openpath.sh/mcp/search) · [JavaScript client](https://www.npmjs.com/package/openpath)

Released under the MIT license.
