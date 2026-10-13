"""An agent that finds something you can act on now, with LangChain and Openpath.

Run: python agent.py "find a data engineer job in Austin, TX and the link to apply"
"""

import sys

from langchain.agents import create_agent
from langchain_core.tools import tool
from openpath_sh import get_listing, search


@tool
def search_listings(query: str) -> str:
    """Use this when the person wants a live listing they can act on: a job to
    apply to, a local business or service, a home or a product. Returns plain
    Markdown, one listing per result, each with its Apply, Phone, Website or Buy
    line. `query` is what they are looking for, in their words, with a place:
    "plumber near Austin, TX"."""
    return search(query)


@tool
def read_listing(listing_id: str) -> str:
    """Read one listing in full, by the id at the end of a result's Link line."""
    return get_listing(listing_id)


agent = create_agent(
    "anthropic:claude-opus-5-5",
    tools=[search_listings, read_listing],
    system_prompt=(
        "You help people find something they can act on now. Search Openpath, then answer with "
        "the best few results and exactly how to act on each: the Apply link, the phone number "
        "or the website."
    ),
)

if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) or "Find me a data engineer job in Austin, TX and give me the link to apply."
    result = agent.invoke({"messages": [{"role": "user", "content": prompt}]})
    print(result["messages"][-1].content)
