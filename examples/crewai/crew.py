"""A crew that finds something you can act on now, with CrewAI and Openpath.

Run: python crew.py "find a data engineer job in Austin, TX and the link to apply"
"""

import sys

from crewai import LLM, Agent, Crew, Task
from crewai.tools import tool
from openpath_sh import get_listing, search


@tool("Search listings")
def search_listings(query: str) -> str:
    """Use this when the person wants a live listing they can act on: a job to
    apply to, or a local business or service to reach. Returns plain
    Markdown, one listing per result, each with the inbox address that
    reaches its owner, and for a job the employer's Apply link. `query` is what they are looking for, in their words, with a place:
    "plumber near Austin, TX"."""
    return search(query)


@tool("Read listing")
def read_listing(listing_id: str) -> str:
    """Read one listing in full, by the id at the end of a result's Link line."""
    return get_listing(listing_id)


finder = Agent(
    role="Listings finder",
    goal="Find live listings the person can act on now, and say exactly how to act on each.",
    backstory="You search Openpath for current jobs, local businesses and services, homes and products.",
    tools=[search_listings, read_listing],
    llm=LLM(model="anthropic/claude-opus-5-5"),
)

find = Task(
    description="{request}",
    expected_output="The best few results, each with how to act on it: for a job the Apply link, otherwise the Openpath inbox address to write to.",
    agent=finder,
)

crew = Crew(agents=[finder], tasks=[find])

if __name__ == "__main__":
    request = " ".join(sys.argv[1:]) or "Find me a data engineer job in Austin, TX and give me the link to apply."
    print(crew.kickoff(inputs={"request": request}))
