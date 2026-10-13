<p align="center">
  <a href="https://openpath.sh"><img src="https://openpath.sh/mark-512.png" width="72" height="72" alt="Openpath"></a>
</p>

# Openpath clients

Search live listings across the US from code: job openings, local businesses and services, homes, products and more. One call returns plain Markdown. No key and no sign-up.

| Language | Install | Search |
|---|---|---|
| JavaScript ([js](js)) | `npm install openpath` | `await search("plumber near Austin, TX")` |
| Python ([python](python)) | `pip install openpath-sh` | `search("plumber near Austin, TX")` |
| Any | | `curl -s -X POST https://api.openpath.sh/v1/connect -H 'Content-Type: application/json' -d '{}'`, then `curl -s -G https://api.openpath.sh/v1/search -H "Authorization: Bearer $TOKEN" --data-urlencode 'q=plumber near Austin, TX'` |

Both clients connect on the first call (one request, no account) and share the token the [Openpath CLI](https://github.com/openpath-sh/cli) saves.

Apps that take an MCP server can add `https://openpath.sh/mcp/search` instead, with no sign-in.

[Openpath](https://openpath.sh) · [Docs](https://openpath.sh/docs) · [API](https://api.openpath.sh/v1/openapi.json)

Released under the MIT license.
