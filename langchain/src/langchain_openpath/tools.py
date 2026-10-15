"""The Openpath tools: search live listings, and read one in full."""

from __future__ import annotations

from typing import Any, Literal, Optional

from langchain_core.tools import BaseTool
from openpath_sh import Openpath
from pydantic import BaseModel, Field

Category = Literal["jobs", "businesses", "homes", "products"]


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
    category: Optional[Category] = Field(
        default=None,
        description="Only one kind of listing. Read from the query when left out.",
    )
    offset: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Where the page starts: 10 results a page, up to 100. A result page's Next page line gives it.",
    )


class ReadInput(BaseModel):
    """What the model sends to read one listing."""

    listing_id: str = Field(min_length=1, description="The id at the end of a result's Link line.")


class OpenpathSearch(BaseTool):
    """Live listings that fit what the person asked for, as plain Markdown."""

    name: str = "openpath_search"
    description: str = (
        "Use this when the person wants a live listing they can act on: "
        "a job to apply to, or a local business or service to reach. "
        "Returns plain Markdown, one listing per result, each with its facts and how to act on it: "
        "the inbox address that reaches its owner, and for a job the employer's Apply link."
    )
    args_schema: type[BaseModel] = SearchInput
    # An openpath_sh.Openpath, or anything with the same methods.
    client: Any = Field(default_factory=Openpath, exclude=True)

    def _run(
        self,
        query: str,
        near: Optional[str] = None,
        category: Optional[str] = None,
        offset: Optional[int] = None,
        **_: object,
    ) -> str:
        return self.client.search(query, near=near, category=category, offset=offset)


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
