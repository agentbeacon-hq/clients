import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from openpath_sh import Openpath, OpenpathError

PAGE = '# Beacons for "plumber free tomorrow near 78704"\n\nRead as: near Austin, TX 78704. 1 beacon.\n'
BEACON = {"id": "b1", "text": "Free tomorrow 9–12 for leaks and clogs", "state": "on", "revision": 2}


class FakeApi:
    """A stand-in for the Openpath API that records what it was asked and answers like the beacon contract."""

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
        if bearer not in self.valid:
            return 401, {}, json.dumps({"code": "connect_first", "detail": "Connect first."})
        if method == "GET" and u.path == "/v1/beacons":
            return 200, {"Content-Type": "text/markdown"}, PAGE
        if method == "GET" and u.path == "/v1/beacons/b1":
            return 200, {"Content-Type": "text/markdown"}, "## Free tomorrow\n"
        if u.path == "/v1/beacons":
            return 201, {}, json.dumps({"beacon": BEACON, "revision": 1, "safety": "pending"})
        return 200, {}, json.dumps({"ok": True})

    def last(self):
        method, path, _, body = self.calls[-1]
        return method, path, body

    def connects(self):
        return sum(1 for c in self.calls if c[1] == "/v1/connect")


class BeaconsTest(unittest.TestCase):
    def client(self, api, **extra):
        home = Path(tempfile.mkdtemp(prefix="openpath-py-"))
        return home, Openpath(send=api, env={}, home=home, **extra)

    def test_connects_saves_the_token_and_returns_markdown(self):
        api = FakeApi()
        home, op = self.client(api)
        self.assertEqual(op.find("plumber free tomorrow", near="78704", offset=10), PAGE)
        self.assertEqual(
            [f"{m} {p}" for m, p, _, _ in api.calls],
            ["POST /v1/connect", "GET /v1/beacons?q=plumber+free+tomorrow&near=78704&offset=10"],
        )
        self.assertEqual(api.calls[1][2]["Authorization"], "Bearer agt_first")
        self.assertEqual(api.calls[1][2]["Accept"], "text/markdown")
        saved = json.loads((home / ".config/openpath/credentials.json").read_text())
        self.assertEqual(saved["https://api.openpath.sh"]["token"], "agt_first")
        self.assertEqual(op.read("b1"), "## Free tomorrow\n")

    def test_reuses_the_saved_token_as_the_cli_does(self):
        api = FakeApi()
        home, op = self.client(api)
        op.find("movers")
        Openpath(send=api, env={}, home=home).read("b1")
        self.assertEqual(api.connects(), 1)

    def test_connects_again_once_when_the_token_stopped_working(self):
        api = FakeApi()
        _, op = self.client(api, token="agt_revoked")
        self.assertEqual(op.find("plumber"), PAGE)
        self.assertEqual(api.connects(), 1)
        self.assertEqual(op.token, "agt_first")

    def test_turns_on_updates_and_switches_off_with_only_the_contract_fields(self):
        api = FakeApi()
        _, op = self.client(api)
        on = op.turn_on(
            "Free tomorrow 9–12 for leaks and clogs",
            until=datetime(2026, 10, 19, 17, tzinfo=timezone.utc),
            near="78704",
            idempotency_key="k1",
        )
        self.assertEqual(on["beacon"]["id"], "b1")
        self.assertEqual(
            api.last(),
            ("POST", "/v1/beacons", {"text": "Free tomorrow 9–12 for leaks and clogs", "until": "2026-10-19T17:00:00Z", "near": "78704"}),
        )
        self.assertEqual(api.calls[-1][2]["Idempotency-Key"], "k1")
        op.update("b1", revision=2, text="Free tomorrow 10–12 only")
        self.assertEqual(api.last(), ("PUT", "/v1/beacons/b1", {"revision": 2, "text": "Free tomorrow 10–12 only"}))
        op.switch_off("b1", "taken")
        self.assertEqual(api.last(), ("POST", "/v1/beacons/b1/off", {"reason": "taken"}))
        with self.assertRaises(ValueError):
            op.switch_off("b1", "sold")
        op.my_beacons()
        self.assertEqual(api.last(), ("GET", "/v1/me/beacons", None))

    def test_answers_replies_marks_and_reports(self):
        api = FakeApi()
        _, op = self.client(api)
        op.answer("b1", "Can you come at 10?")
        self.assertEqual(api.last(), ("POST", "/v1/beacons/b1/answers", {"text": "Can you come at 10?"}))
        op.answers(as_="holder")
        self.assertEqual(api.last()[1], "/v1/me/answers?as=holder")
        op.answers()
        self.assertEqual(api.last()[1], "/v1/me/answers")
        op.read_answer("ans1")
        self.assertEqual(api.last()[1], "/v1/answers/ans1")
        op.reply("ans1", "Yes, 10 works.")
        self.assertEqual(api.last(), ("POST", "/v1/answers/ans1/messages", {"text": "Yes, 10 works."}))
        op.mark_answer("ans1", "booked")
        self.assertEqual(api.last(), ("PUT", "/v1/answers/ans1/outcome", {"outcome": "booked"}))
        with self.assertRaises(ValueError):
            op.mark_answer("ans1", "won")
        op.report_answer("ans1", "spam")
        self.assertEqual(api.last(), ("POST", "/v1/answers/ans1/report", {"reason": "spam", "block": True}))

    def test_names_the_app_first_in_the_user_agent(self):
        api = FakeApi()
        _, op = self.client(api, app="JobFinder/1.0")
        op.find("line cook jobs in Austin")
        self.assertRegex(api.calls[0][2]["User-Agent"], r"^JobFinder/1\.0 openpath-python/1\.0\.0")

    def test_says_why_openpath_refused_what_to_do_next_and_how_long_to_wait(self):
        next_ = "Apply: https://boards.example.com/lucia/1"
        body = json.dumps({"code": "answer_elsewhere", "detail": "This beacon is answered elsewhere.", "next": next_})
        _, op = self.client(FakeApi(refuse=lambda: (409, {"Retry-After": "30"}, body)))
        with self.assertRaises(OpenpathError) as caught:
            op.answer("b1", "Hi")
        self.assertEqual(caught.exception.status, 409)
        self.assertEqual(caught.exception.code, "answer_elsewhere")
        self.assertEqual(caught.exception.retry_after, 30)
        self.assertEqual(caught.exception.next, next_)
        self.assertEqual(str(caught.exception), f"This beacon is answered elsewhere. {next_}")


if __name__ == "__main__":
    unittest.main()
