import json

from langchain_tests.unit_tests import ToolsUnitTests

from langchain_openpath import FindBeacons, ReadBeacon, openpath_tools


class FakeClient:
    """Stands in for openpath_sh.Openpath and records what the tools ask it."""

    def __init__(self):
        self.calls = []

    def __getattr__(self, name):
        def record(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return {"ok": True}

        return record

    def find(self, query, location=None, offset=None):
        self.calls.append(("find", query, location, offset))
        return f'# Beacons for "{query}"'

    def read(self, beacon_id):
        self.calls.append(("read", beacon_id))
        return f"## Beacon {beacon_id}"


def test_find_passes_the_query_place_and_page():
    client = FakeClient()
    out = FindBeacons(client=client).invoke({"query": "plumber free tomorrow", "location": "78704"})
    assert out == '# Beacons for "plumber free tomorrow"'
    assert client.calls == [("find", "plumber free tomorrow", "78704", None)]


def test_the_find_input_has_no_category_and_no_side():
    tool = FindBeacons(client=FakeClient())
    assert set(tool.args) == {"query", "location", "offset"}
    for bad in ({"query": ""}, {"query": "movers", "offset": 110}):
        try:
            tool.invoke(bad)
        except Exception:
            continue
        raise AssertionError(f"{bad} was accepted")


def test_reading_a_beacon_asks_for_it_by_id():
    client = FakeClient()
    assert ReadBeacon(client=client).invoke({"beacon_id": "abc"}) == "## Beacon abc"
    assert client.calls == [("read", "abc")]


def test_only_the_read_tools_unless_asked_for_write_and_then_the_ten():
    assert [t.name for t in openpath_tools(client=FakeClient())] == ["find_beacons", "read_beacon"]
    assert [t.name for t in openpath_tools(client=FakeClient(), write=True)] == [
        "find_beacons",
        "read_beacon",
        "message_beacon",
        "read_conversations",
        "reply",
        "mark_outcome",
        "report_conversation",
        "create_beacon",
        "renew_beacon",
        "update_beacon",
        "delete_beacon",
        "my_beacons",
    ]


def test_the_write_tools_share_one_client_and_call_the_matching_method():
    client = FakeClient()
    tools = {t.name: t for t in openpath_tools(client=client, write=True)}
    assert json.loads(tools["message_beacon"].invoke({"beacon_id": "b1", "text": "Can you come at 10?"})) == {"ok": True}
    tools["read_conversations"].invoke({"about": "my_beacons"})
    tools["read_conversations"].invoke({"conversation_id": "c1"})
    tools["reply"].invoke({"conversation_id": "c1", "text": "Yes"})
    tools["mark_outcome"].invoke({"conversation_id": "c1", "outcome": "booked"})
    tools["report_conversation"].invoke({"conversation_id": "c1", "reason": "spam"})
    tools["create_beacon"].invoke({"text": "Free tomorrow 9–12", "location": "78704"})
    tools["renew_beacon"].invoke({"beacon_id": "b1"})
    tools["renew_beacon"].invoke({"beacon_id": "b1", "location": "30.27,-97.74"})
    tools["update_beacon"].invoke({"beacon_id": "b1", "revision": 2, "text": "Free 10–12"})
    tools["update_beacon"].invoke({"beacon_id": "b1", "revision": 2, "location": "30.2672,-97.7431"})
    tools["delete_beacon"].invoke({"beacon_id": "b1"})
    tools["my_beacons"].invoke({})
    assert client.calls == [
        ("message", ("b1", "Can you come at 10?"), {}),
        ("conversations", (), {"about": "my_beacons", "before": None}),
        ("read_conversation", ("c1",), {}),
        ("reply", ("c1", "Yes"), {}),
        ("mark_outcome", ("c1", "booked"), {}),
        ("report_conversation", ("c1", "spam"), {"block": True}),
        ("create", ("Free tomorrow 9–12",), {"location": "78704"}),
        ("renew", ("b1",), {"location": None}),
        ("renew", ("b1",), {"location": "30.27,-97.74"}),
        ("update", ("b1",), {"revision": 2, "text": "Free 10–12", "location": None}),
        ("update", ("b1",), {"revision": 2, "text": None, "location": "30.2672,-97.7431"}),
        ("delete", ("b1",), {}),
        ("my_beacons", (), {}),
    ]
    try:
        tools["mark_outcome"].invoke({"conversation_id": "c1", "outcome": "won"})
    except Exception:
        pass
    else:
        raise AssertionError("an unknown outcome was accepted")
    assert set(tools["create_beacon"].args) == {"text", "location"}
    assert set(tools["update_beacon"].args) == {"beacon_id", "revision", "text", "location"}
    assert set(tools["renew_beacon"].args) == {"beacon_id", "location"}


class TestFindBeaconsStandard(ToolsUnitTests):
    """LangChain's own checks for a tool."""

    @property
    def tool_constructor(self):
        return FindBeacons

    @property
    def tool_constructor_params(self):
        return {"client": FakeClient()}

    @property
    def tool_invoke_params_example(self):
        return {"query": "plumber free tomorrow near 78704"}
