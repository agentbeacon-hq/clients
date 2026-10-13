from langchain_tests.unit_tests import ToolsUnitTests

from langchain_openpath import OpenpathReadListing, OpenpathSearch, openpath_tools


class FakeClient:
    """Stands in for openpath_sh.Openpath and records what the tools ask it."""

    def __init__(self):
        self.calls = []

    def search(self, query, near=None, domain=None, cursor=None):
        self.calls.append(("search", query, near, domain))
        return f'# Results for "{query}"'

    def get_listing(self, listing_id):
        self.calls.append(("get_listing", listing_id))
        return f"# Listing {listing_id}"


def test_search_passes_the_query_and_its_options():
    client = FakeClient()
    tool = OpenpathSearch(client=client)
    out = tool.invoke({"query": "plumber near Austin, TX", "near": "78701"})
    assert out == '# Results for "plumber near Austin, TX"'
    assert client.calls == [("search", "plumber near Austin, TX", "78701", None)]


def test_the_search_input_is_checked():
    tool = OpenpathSearch(client=FakeClient())
    for bad in ({"query": ""}, {"query": "jobs", "domain": "weather"}):
        try:
            tool.invoke(bad)
        except Exception:
            continue
        raise AssertionError(f"{bad} was accepted")


def test_reading_a_listing_asks_for_it_by_id():
    client = FakeClient()
    out = OpenpathReadListing(client=client).invoke({"listing_id": "abc"})
    assert out == "# Listing abc"
    assert client.calls == [("get_listing", "abc")]


def test_both_tools_share_one_client():
    client = FakeClient()
    search, read = openpath_tools(client=client)
    search.invoke({"query": "tacos in Austin"})
    read.invoke({"listing_id": "x"})
    assert len(client.calls) == 2


class TestOpenpathSearchStandard(ToolsUnitTests):
    """LangChain's own checks for a tool."""

    @property
    def tool_constructor(self):
        return OpenpathSearch

    @property
    def tool_constructor_params(self):
        return {"client": FakeClient()}

    @property
    def tool_invoke_params_example(self):
        return {"query": "plumber near Austin, TX"}
