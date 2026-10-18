import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { Openpath, OpenpathError } from "../index.js";

const PAGE = '# Beacons for "plumber free tomorrow near 78704"\n\nRead as: near Austin, TX 78704. 1 beacon.\n';
const BEACON = { id: "b1", state: "on", shown_revision: null, text: null, latest_revision: 1, latest_text: "Free tomorrow 9–12 for leaks and clogs", latest_safety: "pending", answers_waiting: 0 };

/** A stand-in for the Openpath API: records each call and answers like the beacon contract. */
function fakeApi({ tokens = ["agt_first", "agt_second"], refuse = null } = {}) {
  const calls = [];
  const valid = new Set();
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: u.pathname + u.search, headers: init.headers ?? {}, body });
    if (u.pathname === "/v1/connect") {
      const token = tokens.shift();
      valid.add(token);
      return Response.json(
        { agent_id: "a1", token, line: { handle: "k4m7q2xz9rbt", address: "https://openpath.sh/to/k4m7q2xz9rbt" } },
        { status: 201 },
      );
    }
    if (refuse) return refuse();
    const bearer = (init.headers?.Authorization ?? "").replace("Bearer ", "");
    if (!valid.has(bearer)) return Response.json({ code: "connect_first", detail: "Connect first." }, { status: 401 });
    if (u.pathname === "/v1/beacons" && method === "GET")
      return new Response(PAGE, { headers: { "Content-Type": "text/markdown" } });
    if (u.pathname === "/v1/beacons/b1" && method === "GET")
      return new Response("## Free tomorrow\n> Free tomorrow 9–12\n", { headers: { "Content-Type": "text/markdown" } });
    if (u.pathname === "/v1/beacons") return Response.json({ beacon: BEACON, revision: 1, safety: "pending" }, { status: 201 });
    if (u.pathname.endsWith("/answers"))
      return Response.json({ note: "…", answer: { id: "ans1", beacon_revision: 2, as: "seeker" } }, { status: 201 });
    return Response.json({ ok: true, path: u.pathname, body });
  };
  return { fetch, calls };
}

async function client(api, extra = {}) {
  const home = await mkdtemp(join(tmpdir(), "openpath-js-"));
  return { home, op: new Openpath({ fetch: api.fetch, env: {}, home, ...extra }) };
}

describe("finding and reading beacons", () => {
  it("connects on the first call, saves the token, and returns Markdown", async () => {
    const api = fakeApi();
    const { home, op } = await client(api);
    const page = await op.find("plumber free tomorrow", { near: "78704", offset: 10 });
    assert.equal(page, PAGE);
    assert.deepEqual(
      api.calls.map((c) => `${c.method} ${c.path}`),
      ["POST /v1/connect", "GET /v1/beacons?q=plumber+free+tomorrow&near=78704&offset=10"],
    );
    assert.equal(api.calls[1].headers.Authorization, "Bearer agt_first");
    assert.equal(api.calls[1].headers.Accept, "text/markdown");
    const saved = JSON.parse(await readFile(join(home, ".config/openpath/credentials.json"), "utf8"));
    assert.deepEqual(Object.keys(saved["https://api.openpath.sh"]).sort(), ["agent_id", "connected_at", "token"]);
    assert.match(await op.read("b1"), /^## Free tomorrow/);
  });

  it("reuses the saved token, and connects again once when it was revoked", async () => {
    const api = fakeApi();
    const { home, op } = await client(api);
    await op.find("movers");
    const again = new Openpath({ fetch: api.fetch, env: {}, home });
    await again.find("movers");
    assert.equal(api.calls.filter((c) => c.path === "/v1/connect").length, 1);
    const stale = new Openpath({ fetch: api.fetch, env: {}, home, token: "agt_revoked" });
    await stale.find("movers");
    assert.equal(api.calls.filter((c) => c.path === "/v1/connect").length, 2);
  });

  it("says who it acts for at connect only when told, and never again", async () => {
    const api = fakeApi();
    const { op } = await client(api, { holder: "business" });
    await op.find("movers");
    await op.find("movers");
    assert.deepEqual(api.calls.filter((c) => c.path === "/v1/connect").map((c) => c.body), [{ holder: "business" }]);
    const plain = fakeApi();
    await (await client(plain)).op.find("movers");
    assert.deepEqual(plain.calls[0].body, {});
  });

  it("uses OPENPATH_TOKEN before the saved token, and ignores the old name", async () => {
    const api = fakeApi();
    const home = await mkdtemp(join(tmpdir(), "openpath-js-"));
    await new Openpath({ fetch: api.fetch, env: { OPENPATH_TOKEN: "agt_env" }, home }).find("movers");
    assert.equal(api.calls[0].headers.Authorization, "Bearer agt_env");
    const old = fakeApi();
    await new Openpath({ fetch: old.fetch, env: { OPENPATH_AGENT_TOKEN: "agt_env" }, home: await mkdtemp(join(tmpdir(), "openpath-js-")) }).find("movers");
    assert.equal(old.calls[0].path, "/v1/connect");
  });
});

describe("as a holder and a seeker", () => {
  it("turns on, updates and switches off a beacon, with the fields the contract takes and no others", async () => {
    const api = fakeApi();
    const { op } = await client(api);
    const on = await op.turnOn("Free tomorrow 9–12 for leaks and clogs", {
      until: new Date("2026-10-19T17:00:00Z"),
      near: "78704",
      idempotencyKey: "k1",
    });
    assert.equal(on.beacon.id, "b1");
    const turnOn = api.calls.at(-1);
    assert.equal(turnOn.method, "POST");
    assert.deepEqual(turnOn.body, {
      text: "Free tomorrow 9–12 for leaks and clogs",
      until: "2026-10-19T17:00:00.000Z",
      near: "78704",
    });
    assert.equal(turnOn.headers["Idempotency-Key"], "k1");
    await op.update("b1", { revision: 2, text: "Free tomorrow 10–12 only" });
    assert.deepEqual(
      [api.calls.at(-1).method, api.calls.at(-1).path, api.calls.at(-1).body],
      ["PUT", "/v1/beacons/b1", { revision: 2, text: "Free tomorrow 10–12 only" }],
    );
    await op.switchOff("b1", "taken");
    assert.deepEqual([api.calls.at(-1).path, api.calls.at(-1).body], ["/v1/beacons/b1/off", { reason: "taken" }]);
    await op.myBeacons();
    assert.equal(api.calls.at(-1).path, "/v1/me/beacons");
  });

  it("answers, reads answers, replies, marks the outcome and reports", async () => {
    const api = fakeApi();
    const { op } = await client(api);
    const sent = await op.answer("b1", "Can you come at 10?");
    assert.equal(sent.answer.id, "ans1");
    assert.deepEqual(api.calls.at(-1).body, { text: "Can you come at 10?" });
    await op.answers({ as: "holder" });
    assert.equal(api.calls.at(-1).path, "/v1/me/answers?as=holder");
    await op.answers();
    assert.equal(api.calls.at(-1).path, "/v1/me/answers");
    await op.readAnswer("ans1");
    assert.equal(api.calls.at(-1).path, "/v1/answers/ans1");
    await op.reply("ans1", "Yes, 10 works.");
    assert.deepEqual([api.calls.at(-1).path, api.calls.at(-1).body], ["/v1/answers/ans1/messages", { text: "Yes, 10 works." }]);
    await op.markAnswer("ans1", "booked");
    assert.deepEqual([api.calls.at(-1).method, api.calls.at(-1).body], ["PUT", { outcome: "booked" }]);
    await op.reportAnswer("ans1", "spam");
    assert.deepEqual(api.calls.at(-1).body, { reason: "spam", block: true });
  });

  it("says why Openpath refused, what to do next, and how long to wait", async () => {
    const next = "Apply: https://boards.example.com/lucia/1";
    const api = fakeApi({
      refuse: () =>
        Response.json(
          { code: "answer_elsewhere", detail: "This beacon is answered elsewhere.", next },
          { status: 409, headers: { "Retry-After": "30" } },
        ),
    });
    const { op } = await client(api);
    await assert.rejects(op.answer("b1", "Hi"), (error) => {
      assert.ok(error instanceof OpenpathError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "answer_elsewhere");
      assert.equal(error.next, next);
      assert.equal(error.retryAfter, 30);
      assert.equal(error.message, `This beacon is answered elsewhere. ${next}`);
      return true;
    });
  });

  it("names the app first in the User-Agent", async () => {
    const api = fakeApi();
    const { op } = await client(api, { app: "JobFinder/1.0" });
    await op.find("line cook jobs in Austin");
    assert.match(api.calls[1].headers["User-Agent"], /^JobFinder\/1\.0 openpath-js\/1\.0\.0/);
  });
});
