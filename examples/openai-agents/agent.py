"""An agent that finds something you can act on now, with the OpenAI Agents SDK
and Openpath. It uses the SDK's default model; set OPENAI_API_KEY first.

Run: python agent.py "find taco places in Austin, TX"
"""

import sys

from agents import Agent, Runner, function_tool
from openpath_sh import get_listing, search


@function_tool
def search_listings(query: str) -> str:
    """Use this when the person wants a live listing they can act on: a job to
    apply to, a local business or service, a home or a product. Returns plain
    Markdown, one listing per result, each with its Apply, Phone, Website or Buy
    line.

    Args:
        query: What the person is looking for, in their words, with a place:
            "plumber near Austin, TX".
    """
    return search(query)


@function_tool
def read_listing(listing_id: str) -> str:
    """Read one listing in full, by the id at the end of a result's Link line.

    Args:
        listing_id: The listing id.
    """
    return get_listing(listing_id)


agent = Agent(
    name="Listings agent",
    instructions=(
        "You help people find something they can act on now. Search Openpath, then answer with "
        "the best few results and exactly how to act on each: the Apply link, the phone number "
        "or the website."
    ),
    tools=[search_listings, read_listing],
)

if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) or "Find taco places in Austin, TX and tell me how to reach them."
    print(Runner.run_sync(agent, prompt).final_output)
