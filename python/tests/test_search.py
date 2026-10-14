import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlparse

from openpath_sh import Openpath, OpenpathError

RESULTS = '# Results for "plumber near Austin, TX"\n\nSearched: local services, Austin, TX. 1 result.\n'


class FakeApi:
    """A stand-in for the Openpath API that records what it was asked."""

    def __init__(self, tokens=("agt_first", "agt_second"), refuse=None):
        self.tokens = list(tokens)
        self.valid = set()
        self.refuse = refuse
        self.calls = []

    def __call__(self, method, url, headers, body):
        u = urlparse(url)
        path = u.path + (f"?{u.query}" if u.query else "")
        self.calls.append((method, path, headers))
        if u.path == "/v1/connect":
            token = self.tokens.pop(0)
            self.valid.add(token)
            return 200, {}, json.dumps({"agent_id": "a1", "agent_token": token})
        if self.refuse:
            return self.refuse()
        bearer = headers.get("Authorization", "").replace("Bearer ", "")
        if bearer not in self.valid:
            return 401, {}, json.dumps({"code": "connect_first", "detail": "Connect first."})
        return 200, {"Content-Type": "text/markdown"}, RESULTS if u.path == "/v1/search" else "# Tacos Luna in Austin\n"

    def connects(self):
        return sum(1 for _, path, _ in self.calls if path == "/v1/connect")


class SearchTest(unittest.TestCase):
    def client(self, api, **extra):
        home = Path(tempfile.mkdtemp(prefix="openpath-py-"))
        return home, Openpath(send=api, env={}, home=home, **extra)

    def test_connects_saves_the_token_and_returns_markdown(self):
        api = FakeApi()
        home, op = self.client(api)
        self.assertEqual(op.search("plumber near Austin, TX", domain="services"), RESULTS)
        self.assertEqual(
            [f"{m} {p}" for m, p, _ in api.calls],
            ["POST /v1/connect", "GET /v1/search?q=plumber+near+Austin%2C+TX&domain=services"],
        )
        self.assertEqual(api.calls[1][2]["Authorization"], "Bearer agt_first")
        self.assertEqual(api.calls[1][2]["Accept"], "text/markdown")
        saved = json.loads((home / ".config/openpath/credentials.json").read_text())
        self.assertEqual(saved["https://api.openpath.sh"]["agent_token"], "agt_first")

    def test_reuses_the_saved_token_as_the_cli_does(self):
        api = FakeApi()
        home, op = self.client(api)
        op.search("tacos in Austin")
        Openpath(send=api, env={}, home=home).get_listing("48b8f5bd-4140-48a0-b4b4-47ee25633111")
        self.assertEqual(api.connects(), 1)

    def test_connects_again_once_when_the_token_stopped_working(self):
        api = FakeApi()
        _, op = self.client(api, token="agt_revoked")
        self.assertEqual(op.search("plumber"), RESULTS)
        self.assertEqual(api.connects(), 1)
        self.assertEqual(op.token, "agt_first")

    def test_names_the_app_first_in_the_user_agent(self):
        api = FakeApi()
        _, op = self.client(api, app="JobFinder/1.0")
        op.search("data engineer jobs in Austin")
        self.assertRegex(api.calls[0][2]["User-Agent"], r"^JobFinder/1\.0 openpath-python/\d")

    def test_says_why_openpath_refused_and_how_long_to_wait(self):
        api = FakeApi(refuse=lambda: (429, {"Retry-After": "30"}, json.dumps({"code": "rate_limited", "detail": "Too many searches."})))
        _, op = self.client(api)
        with self.assertRaises(OpenpathError) as caught:
            op.search("plumber")
        self.assertEqual(caught.exception.status, 429)
        self.assertEqual(caught.exception.code, "rate_limited")
        self.assertEqual(caught.exception.retry_after, 30)
        self.assertEqual(str(caught.exception), "Too many searches.")

    def test_rejects_an_unknown_domain(self):
        _, op = self.client(FakeApi())
        with self.assertRaises(ValueError):
            op.search("plumber", domain="plumbers")


if __name__ == "__main__":
    unittest.main()
