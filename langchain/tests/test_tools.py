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

    def find(self, query, near=None, offset=None):
        self.calls.append(("find", query, near, offset))
        return f'# Beacons for "{query}"'

    def read(self, beacon_id):
        self.calls.append(("read", beacon_id))
        return f"## Beacon {beacon_id}"


def test_find_passes_the_query_place_and_page():
    client = FakeClient()
    out = FindBeacons(client=client).invoke({"query": "plumber free tomorrow", "near": "78704"})
    assert out == '# Beacons for "plumber free tomorrow"'
    assert client.calls == [("find", "plumber free tomorrow", "78704", None)]


def test_the_find_input_has_no_category_and_no_side():
    tool = FindBeacons(client=FakeClient())
    assert set(tool.args) == {"query", "near", "offset"}
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


def test_only_the_read_tools_unless_asked_for_write():
    assert [t.name for t in openpath_tools(client=FakeClient())] == ["find_beacons", "read_beacon"]
    assert [t.name for t in openpath_tools(client=FakeClient(), write=True)] == [
        "find_beacons",
        "read_beacon",
        "answer_beacon",
        "read_answers",
        "reply",
        "mark_answer",
        "report_answer",
        "turn_on_beacon",
        "update_beacon",
        "switch_off_beacon",
        "my_beacons",
    ]


def test_the_write_tools_share_one_client_and_call_the_matching_method():
    client = FakeClient()
    tools = {t.name: t for t in openpath_tools(client=client, write=True)}
    assert json.loads(tools["answer_beacon"].invoke({"beacon_id": "b1", "text": "Can you come at 10?"})) == {"ok": True}
    tools["read_answers"].invoke({"as": "holder"})
    tools["reply"].invoke({"answer_id": "a1", "text": "Yes"})
    tools["mark_answer"].invoke({"answer_id": "a1", "outcome": "booked"})
    tools["report_answer"].invoke({"answer_id": "a1", "reason": "spam"})
    tools["turn_on_beacon"].invoke({"text": "Free tomorrow 9–12", "near": "78704"})
    tools["update_beacon"].invoke({"beacon_id": "b1", "revision": 2, "text": "Free 10–12"})
    tools["switch_off_beacon"].invoke({"beacon_id": "b1", "reason": "taken"})
    tools["my_beacons"].invoke({})
    assert client.calls == [
        ("answer", ("b1", "Can you come at 10?"), {}),
        ("answers", (), {"as_": "holder", "before": None}),
        ("reply", ("a1", "Yes"), {}),
        ("mark_answer", ("a1", "booked"), {}),
        ("report_answer", ("a1", "spam"), {}),
        ("turn_on", ("Free tomorrow 9–12",), {"until": None, "near": "78704"}),
        ("update", ("b1",), {"revision": 2, "text": "Free 10–12", "until": None, "near": None}),
        ("switch_off", ("b1", "taken"), {}),
        ("my_beacons", (), {}),
    ]
    try:
        tools["mark_answer"].invoke({"answer_id": "a1", "outcome": "won"})
    except Exception:
        pass
    else:
        raise AssertionError("an unknown outcome was accepted")


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
