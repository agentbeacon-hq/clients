import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { Openpath, OpenpathError } from "../index.js";

const RESULTS = "# Results for \"plumber near Austin, TX\"\n\nSearched: local services, Austin, TX. 1 result.\n";

/** A stand-in for the Openpath API that records what it was asked. */
function fakeApi({ tokens = ["agt_first", "agt_second"], refuse = null } = {}) {
  const calls = [];
  const valid = new Set();
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ method: init.method ?? "GET", path: u.pathname + u.search, headers: init.headers ?? {} });
    if (u.pathname === "/v1/connect") {
      const token = tokens.shift();
      valid.add(token);
      return Response.json({ agent_id: "a1", agent_token: token });
    }
    if (refuse) return refuse();
    const bearer = (init.headers?.Authorization ?? "").replace("Bearer ", "");
    if (!valid.has(bearer)) {
      return Response.json({ code: "connect_first", detail: "Connect first." }, { status: 401 });
    }
    return new Response(u.pathname === "/v1/search" ? RESULTS : "# Tacos Luna in Austin\n", {
      headers: { "Content-Type": "text/markdown" },
    });
  };
  return { fetch, calls };
}

async function client(api, extra = {}) {
  const home = await mkdtemp(join(tmpdir(), "openpath-js-"));
  return { home, op: new Openpath({ fetch: api.fetch, env: {}, home, ...extra }) };
}

describe("search", () => {
  it("connects on the first call, saves the token, and returns Markdown", async () => {
    const api = fakeApi();
    const { home, op } = await client(api);
    const page = await op.search("plumber near Austin, TX", { domain: "services" });
    assert.equal(page, RESULTS);
    assert.deepEqual(api.calls.map((c) => c.method + " " + c.path), [
      "POST /v1/connect",
      "GET /v1/search?q=plumber+near+Austin%2C+TX&domain=services",
    ]);
    assert.equal(api.calls[1].headers.Authorization, "Bearer agt_first");
    assert.equal(api.calls[1].headers.Accept, "text/markdown");
    const saved = JSON.parse(await readFile(join(home, ".config/ads/credentials.json"), "utf8"));
    assert.equal(saved["https://api.openpath.sh"].agent_token, "agt_first");
  });

  it("reuses the saved token, as the Openpath CLI does", async () => {
    const api = fakeApi();
    const { home, op } = await client(api);
    await op.search("tacos in Austin");
    const again = new Openpath({ fetch: api.fetch, env: {}, home });
    await again.getListing("48b8f5bd-4140-48a0-b4b4-47ee25633111");
    assert.equal(api.calls.filter((c) => c.path === "/v1/connect").length, 1);
  });

  it("connects only once when calls start together", async () => {
    const api = fakeApi();
    const { op } = await client(api);
    await Promise.all([op.search("a"), op.search("b"), op.search("c")]);
    assert.equal(api.calls.filter((c) => c.path === "/v1/connect").length, 1);
  });

  it("connects again, once, when the token stopped working", async () => {
    const api = fakeApi();
    const { home, op } = await client(api, { token: "agt_revoked" });
    assert.equal(await op.search("plumber"), RESULTS);
    assert.equal(api.calls.filter((c) => c.path === "/v1/connect").length, 1);
    assert.equal(op.token, "agt_first");
    assert.ok(home);
  });

  it("names the app first in the User-Agent", async () => {
    const api = fakeApi();
    const { op } = await client(api, { app: "JobFinder/1.0" });
    await op.search("data engineer jobs in Austin");
    assert.match(api.calls[0].headers["User-Agent"], /^JobFinder\/1\.0 openpath-js\/\d/);
  });

  it("says why Openpath refused, and how long to wait", async () => {
    const api = fakeApi({
      refuse: () =>
        Response.json(
          { code: "rate_limited", detail: "Too many searches." },
          { status: 429, headers: { "Retry-After": "30" } },
        ),
    });
    const { op } = await client(api);
    await assert.rejects(op.search("plumber"), (error) => {
      assert.ok(error instanceof OpenpathError);
      assert.equal(error.status, 429);
      assert.equal(error.code, "rate_limited");
      assert.equal(error.retryAfter, 30);
      assert.equal(error.message, "Too many searches.");
      return true;
    });
  });
});
