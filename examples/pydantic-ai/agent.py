"""An agent that finds something you can act on now, with Pydantic AI and Openpath.

Run: python agent.py "find a plumber near Austin, TX who can come today"
"""

import sys

from openpath_sh import get_listing, search
from pydantic_ai import Agent

agent = Agent(
    "anthropic:claude-opus-5-5",
    instructions=(
        "You help people find something they can act on now. Search Openpath, then answer with "
        "the best few results and exactly how to act on each: for a job the Apply link, "
        "otherwise the Openpath inbox address to write to."
    ),
)


@agent.tool_plain
def search_listings(query: str) -> str:
    """Use this when the person wants a live listing they can act on: a job to
    apply to, or a local business or service to reach. Returns plain
    Markdown, one listing per result, each with the inbox address that
    reaches its owner, and for a job the employer's Apply link.

    Args:
        query: What the person is looking for, in their words, with a place:
            "plumber near Austin, TX".
    """
    return search(query)


@agent.tool_plain
def read_listing(listing_id: str) -> str:
    """Read one listing in full, by the id at the end of a result's Link line.

    Args:
        listing_id: The listing id.
    """
    return get_listing(listing_id)


if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) or "Find a plumber near Austin, TX who can come today."
    print(agent.run_sync(prompt).output)
