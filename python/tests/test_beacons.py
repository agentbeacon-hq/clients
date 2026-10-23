import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlparse

from agentbeacon_sdk import AgentBeacon, AgentBeaconError

PAGE = '# Beacons for "plumber free tomorrow near 78704"\n\nRead as: near Austin, TX 78704. 1 beacon.\n'
BEACON = {
    "id": "b1",
    "beacon": {
        "text": "Free tomorrow 9–12 for leaks and clogs",
        "location": {"lat": 30.2416, "lng": -97.7695, "updated": "2026-10-19T16:00:00Z"},
        "expires": "2026-10-19T17:00:00Z",
    },
    "verification": {"issuer": "agentbeacon.sh", "summary": "Nothing about who made this was checked. Active 1 day. Never reported."},
    "link": "https://agentbeacon.sh/beacon/b1",
    "mine": {
        "closed": False,
        "renew_from": "2026-10-19T16:45:00Z",
        "deletes_at": None,
        "revision": None,
        "latest": {"revision": 1, "text": "Free tomorrow 9–12 for leaks and clogs", "safety": "pending", "reason": None},
        "conversations_waiting": 0,
    },
}
POINT = {"lat": 30.2416, "lng": -97.7695}


class FakeApi:
    """A stand-in for the AgentBeacon API that records what it was asked and answers like the
    beacon contract. Searching and reading need no token; a token that is sent must be valid."""

    def __init__(self, tokens=("agt_first", "agt_second"), refuse=None):
        self.tokens = list(tokens)
        self.valid = set()
        self.refuse = refuse
        self.calls = []

    def __call__(self, method, url, headers, body):
        u = urlparse(url)
        path = u.path + (f"?{u.query}" if u.query else "")
        self.calls.append((method, path, headers, json.loads(body) if body else None))
        if u.path == "/v1/connect":
            token = self.tokens.pop(0)
            self.valid.add(token)
            return 201, {}, json.dumps({"agent_id": "a1", "token": token})
        if self.refuse:
            return self.refuse()
        bearer = headers.get("Authorization", "").replace("Bearer ", "")
        if bearer and bearer not in self.valid:
            return 401, {}, json.dumps({"code": "connect_first", "detail": "Connect first."})
        if method == "GET" and u.path == "/v1/beacons":
            return 200, {"Content-Type": "text/markdown"}, PAGE
        if method == "GET" and u.path == "/v1/beacons/b1":
            return 200, {"Content-Type": "text/markdown"}, "## Free tomorrow\n"
        if not bearer:
            return 401, {}, json.dumps({"code": "connect_first", "detail": "Connect first."})
        if u.path == "/v1/beacons":
            return 201, {}, json.dumps({"beacon": BEACON, "revision": 1, "safety": "pending"})
        return 200, {}, json.dumps({"ok": True})

    def last(self):
        method, path, _, body = self.calls[-1]
        return method, path, body

    def connects(self):
        return sum(1 for c in self.calls if c[1] == "/v1/connect")


class ClientTest(unittest.TestCase):
    def client(self, api, **extra):
        home = Path(tempfile.mkdtemp(prefix="agentbeacon-py-"))
        return home, AgentBeacon(send=api, env={}, home=home, **extra)


class FindingTest(ClientTest):
    def test_finds_and_reads_with_no_token_and_without_connecting(self):
        api = FakeApi()
        home, op = self.client(api)
        self.assertEqual(op.search("plumber free tomorrow", location="78704", offset=10), PAGE)
        self.assertEqual(op.read("b1"), "## Free tomorrow\n")
        self.assertEqual(
            [f"{m} {p}" for m, p, _, _ in api.calls],
            ["GET /v1/beacons?q=plumber+free+tomorrow&location=78704&offset=10", "GET /v1/beacons/b1"],
        )
        self.assertNotIn("Authorization", api.calls[0][2])
        self.assertEqual(api.calls[0][2]["Accept"], "text/markdown")
        self.assertFalse((home / ".config/agentbeacon/credentials.json").exists())

    def test_sends_a_token_it_already_has_and_finds_without_it_when_revoked(self):
        api = FakeApi()
        home, op = self.client(api)
        op.my_beacons()
        AgentBeacon(send=api, env={}, home=home).search("movers")
        self.assertEqual(api.calls[-1][2]["Authorization"], "Bearer agt_first")
        _, stale = self.client(api, token="agt_revoked")
        self.assertEqual(stale.search("movers"), PAGE)
        self.assertNotIn("Authorization", api.calls[-1][2])
        self.assertEqual(api.connects(), 1)

    def test_uses_agentbeacon_token_and_ignores_the_old_name(self):
        api = FakeApi()
        AgentBeacon(send=api, env={"AGENTBEACON_TOKEN": "agt_env"}, home=Path(tempfile.mkdtemp())).search("movers")
        self.assertEqual(api.calls[0][2]["Authorization"], "Bearer agt_env")
        old = FakeApi()
        AgentBeacon(send=old, env={"OPENPATH_TOKEN": "agt_env"}, home=Path(tempfile.mkdtemp())).search("movers")
        self.assertNotIn("Authorization", old.calls[0][2])

    def test_names_the_app_first_in_the_user_agent(self):
        api = FakeApi()
        _, op = self.client(api, app="JobFinder/1.0")
        op.search("line cook jobs in Austin")
        self.assertRegex(api.calls[0][2]["User-Agent"], r"^JobFinder/1\.0 agentbeacon-python/0\.1\.0")


class ConnectingTest(ClientTest):
    def test_connects_with_no_body_saves_the_token_and_reuses_it_as_the_cli_does(self):
        api = FakeApi()
        home, op = self.client(api)
        op.my_beacons()
        method, path, headers, body = api.calls[0]
        self.assertEqual((method, path, body), ("POST", "/v1/connect", None))
        self.assertNotIn("Content-Type", headers)
        self.assertEqual(api.calls[1][2]["Authorization"], "Bearer agt_first")
        saved = json.loads((home / ".config/agentbeacon/credentials.json").read_text())
        self.assertEqual(saved["https://api.agentbeacon.sh"]["token"], "agt_first")
        AgentBeacon(send=api, env={}, home=home).my_beacons()
        self.assertEqual(api.connects(), 1)

    def test_connects_again_once_when_the_token_stopped_working(self):
        api = FakeApi()
        _, op = self.client(api, token="agt_revoked")
        op.my_beacons()
        self.assertEqual(
            [f"{m} {p}" for m, p, _, _ in api.calls],
            ["GET /v1/me/beacons", "POST /v1/connect", "GET /v1/me/beacons"],
        )
        self.assertEqual(op.token, "agt_first")


class BusinessTest(ClientTest):
    def test_creates_renews_updates_and_deletes_with_only_the_contract_fields(self):
        api = FakeApi()
        _, op = self.client(api)
        created = op.create("Free tomorrow 9–12 for leaks and clogs", location=POINT, idempotency_key="k1")
        self.assertEqual(created["beacon"]["id"], "b1")
        self.assertEqual(created["beacon"]["mine"]["latest"]["revision"], 1)
        self.assertEqual(api.last(), ("POST", "/v1/beacons", {"text": "Free tomorrow 9–12 for leaks and clogs", "location": POINT}))
        self.assertEqual(api.calls[-1][2]["Idempotency-Key"], "k1")
        op.create("Remote bookkeeping help, evenings.")
        self.assertEqual(api.last(), ("POST", "/v1/beacons", {"text": "Remote bookkeeping help, evenings."}))
        with self.assertRaises(TypeError):
            op.create("Free tomorrow", location="78704")
        op.renew("b1")
        self.assertEqual(api.last(), ("POST", "/v1/beacons/b1/renew", None))
        op.update("b1", revision=2, text="Free tomorrow 10–12 only")
        self.assertEqual(api.last(), ("PUT", "/v1/beacons/b1", {"revision": 2, "text": "Free tomorrow 10–12 only"}))
        op.update("b1", revision=2, text="Free tomorrow 10–12 only", location=POINT)
        self.assertEqual(api.last(), ("PUT", "/v1/beacons/b1", {"revision": 2, "text": "Free tomorrow 10–12 only", "location": POINT}))
        op.update("b1", revision=2, location=None)
        self.assertEqual(api.last(), ("PUT", "/v1/beacons/b1", {"revision": 2, "location": None}))
        op.delete("b1")
        self.assertEqual(api.last(), ("DELETE", "/v1/beacons/b1", None))
        op.my_beacons()
        self.assertEqual(api.last(), ("GET", "/v1/me/beacons", None))
        op.set_taking_messages(False)
        self.assertEqual(api.last(), ("PUT", "/v1/me/messages", {"taking_messages": False}))

    def test_on_the_move_it_sends_only_the_point_and_renew_can_carry_it(self):
        api = FakeApi()
        _, op = self.client(api)
        op.update_location("b1", 30.2672, -97.7431, revision=3)
        self.assertEqual(api.last(), ("PUT", "/v1/beacons/b1", {"revision": 3, "location": {"lat": 30.2672, "lng": -97.7431}}))
        op.renew("b1", location={"lat": 30.27, "lng": -97.74})
        self.assertEqual(api.last(), ("POST", "/v1/beacons/b1/renew", {"location": {"lat": 30.27, "lng": -97.74}}))
        self.assertEqual(api.calls[-1][2]["Content-Type"], "application/json")

    def test_a_location_sent_too_soon_says_how_long_to_wait(self):
        body = json.dumps({"code": "rate_limited", "detail": "Updated less than 3 seconds ago.", "next": "Send it at most once every 3 seconds."})
        _, op = self.client(FakeApi(refuse=lambda: (429, {"Retry-After": "2"}, body)))
        with self.assertRaises(AgentBeaconError) as caught:
            op.update_location("b1", 30.2672, -97.7431, revision=3)
        self.assertEqual(caught.exception.status, 429)
        self.assertEqual(caught.exception.code, "rate_limited")
        self.assertEqual(caught.exception.retry_after, 2)


class ConversationsTest(ClientTest):
    def test_messages_lists_reads_replies_marks_and_reports(self):
        api = FakeApi()
        _, op = self.client(api)
        op.message("b1", "Can you come at 10?")
        self.assertEqual(api.last(), ("POST", "/v1/beacons/b1/messages", {"text": "Can you come at 10?"}))
        op.conversations(about="my_beacons")
        self.assertEqual(api.last()[1], "/v1/me/conversations?about=my_beacons")
        op.conversations()
        self.assertEqual(api.last()[1], "/v1/me/conversations")
        with self.assertRaises(ValueError):
            op.conversations(about="holder")
        op.read_conversation("c1")
        self.assertEqual(api.last()[1], "/v1/conversations/c1")
        op.reply("c1", "Yes, 10 works.")
        self.assertEqual(api.last(), ("POST", "/v1/conversations/c1/messages", {"text": "Yes, 10 works."}))
        op.mark_outcome("c1", "booked")
        self.assertEqual(api.last(), ("PUT", "/v1/conversations/c1/outcome", {"outcome": "booked"}))
        with self.assertRaises(ValueError):
            op.mark_outcome("c1", "won")
        op.report_conversation("c1", "spam")
        self.assertEqual(api.last(), ("POST", "/v1/conversations/c1/report", {"reason": "spam", "block": True}))

    def test_says_why_agentbeacon_refused_what_to_do_next_and_how_long_to_wait(self):
        next_ = "Tell the person, and offer others."
        detail = "This beacon expired: its creator didn’t renew it."
        body = json.dumps({"code": "beacon_closed", "detail": detail, "next": next_})
        _, op = self.client(FakeApi(refuse=lambda: (410, {"Retry-After": "30"}, body)))
        with self.assertRaises(AgentBeaconError) as caught:
            op.message("b1", "Hi")
        self.assertEqual(caught.exception.status, 410)
        self.assertEqual(caught.exception.code, "beacon_closed")
        self.assertEqual(caught.exception.retry_after, 30)
        self.assertEqual(caught.exception.next, next_)
        self.assertEqual(str(caught.exception), f"{detail} {next_}")


if __name__ == "__main__":
    unittest.main()
