"""The Openpath tools: search live listings, and read one in full."""

from __future__ import annotations

from typing import Any, Literal, Optional

from langchain_core.tools import BaseTool
from openpath_sh import Openpath
from pydantic import BaseModel, Field

Domain = Literal["homes", "work", "services", "businesses", "goods", "cars", "events"]


class SearchInput(BaseModel):
    """What the model sends to search."""

    query: str = Field(
        min_length=1,
        max_length=300,
        description='What the person is looking for, in their words, with a place: "plumber near Austin, TX".',
    )
    near: Optional[str] = Field(
        default=None,
        description='A place ("Austin, TX", "78701") or "lat,lng". Overrides a place in the query.',
    )
    domain: Optional[Domain] = Field(
        default=None,
        description="Only one kind of listing. Read from the query when left out.",
    )


class ReadInput(BaseModel):
    """What the model sends to read one listing."""

    listing_id: str = Field(min_length=1, description="The id at the end of a result's Link line.")


class OpenpathSearch(BaseTool):
    """Live listings across the US that fit what the person asked for, as plain Markdown."""

    name: str = "openpath_search"
    description: str = (
        "Use this when the person wants a live listing they can act on, anywhere in the US: "
        "a job to apply to, a local business or service to call, a home, a product, a car or an event. "
        "Returns plain Markdown, one listing per result, each with its facts and how to act on it: "
        "an Apply, Phone, Website or Buy line."
    )
    args_schema: type[BaseModel] = SearchInput
    # An openpath_sh.Openpath, or anything with the same methods.
    client: Any = Field(default_factory=Openpath, exclude=True)

    def _run(self, query: str, near: Optional[str] = None, domain: Optional[str] = None, **_: object) -> str:
        return self.client.search(query, near=near, domain=domain)


class OpenpathReadListing(BaseTool):
    """One Openpath listing in full, as Markdown."""

    name: str = "openpath_read_listing"
    description: str = (
        "Read one Openpath listing in full, as Markdown, by the id at the end of a result's Link line. "
        "Use it to re-read a result before acting on it."
    )
    args_schema: type[BaseModel] = ReadInput
    # An openpath_sh.Openpath, or anything with the same methods.
    client: Any = Field(default_factory=Openpath, exclude=True)

    def _run(self, listing_id: str, **_: object) -> str:
        return self.client.get_listing(listing_id)


def openpath_tools(app: Optional[str] = None, client: Optional[Openpath] = None) -> list[BaseTool]:
    """Both tools, sharing one client. `app` names your app to Openpath, such as "MyAgent/1.0"."""
    shared = client or Openpath(app=app)
    return [OpenpathSearch(client=shared), OpenpathReadListing(client=shared)]
