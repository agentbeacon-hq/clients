import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { Openpath, OpenpathError } from "../index.js";

const PAGE = '# Beacons for "plumber free tomorrow near 78704"\n\nRead as: near Austin, TX 78704. 1 beacon.\n';
const BEACON = {
  id: "b1",
  beacon: {
    text: "Free tomorrow 9–12 for leaks and clogs",
    location: { lat: 30.2416, lng: -97.7695, updated: "2026-10-19T16:00:00Z" },
    expires: "2026-10-19T17:00:00Z",
  },
  verification: { issuer: "openpath.sh", summary: "Nothing about who made this was checked. Active 1 day. Never reported." },
  link: "https://openpath.sh/beacon/b1",
  mine: {
    closed: false,
    renew_from: "2026-10-19T16:45:00Z",
    deletes_at: null,
    revision: null,
    latest: { revision: 1, text: "Free tomorrow 9–12 for leaks and clogs", safety: "pending", reason: null },
    conversations_waiting: 0,
  },
};

/**
 * A stand-in for the Beacon API: records each call and answers like the beacon
 * contract. Searching and reading need no token; a token that is sent must be valid.
 */
function fakeApi({ tokens = ["agt_first", "agt_second"], refuse = null } = {}) {
  const calls = [];
  const valid = new Set();
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ method, path: u.pathname + u.search, headers: init.headers ?? {}, body: init.body });
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (u.pathname === "/v1/connect") {
      const token = tokens.shift();
      valid.add(token);
      return Response.json({ agent_id: "a1", token }, { status: 201 });
    }
    if (refuse) return refuse();
    const bearer = (init.headers?.Authorization ?? "").replace("Bearer ", "");
    if (bearer && !valid.has(bearer)) return Response.json({ code: "connect_first", detail: "Connect first." }, { status: 401 });
    if (u.pathname === "/v1/beacons" && method === "GET")
      return new Response(PAGE, { headers: { "Content-Type": "text/markdown" } });
    if (u.pathname === "/v1/beacons/b1" && method === "GET")
      return new Response("## Free tomorrow\n> Free tomorrow 9–12\n", { headers: { "Content-Type": "text/markdown" } });
    if (!bearer) return Response.json({ code: "connect_first", detail: "Connect first." }, { status: 401 });
    if (u.pathname === "/v1/beacons") return Response.json({ beacon: BEACON, revision: 1, safety: "pending" }, { status: 201 });
    if (u.pathname.endsWith("/b1/messages"))
      return Response.json({ note: "…", conversation: { id: "c1", beacon_revision: 2, about: "sent" } }, { status: 201 });
    return Response.json({ ok: true, path: u.pathname, body });
  };
  return { fetch, calls };
}

async function client(api, extra = {}) {
  const home = await mkdtemp(join(tmpdir(), "openpath-js-"));
  return { home, op: new Openpath({ fetch: api.fetch, env: {}, home, ...extra }) };
}

const exists = (file) => stat(file).then(() => true, () => false);

describe("searching and reading beacons", () => {
  it("searches and reads with no token and without connecting", async () => {
    const api = fakeApi();
    const { home, op } = await client(api);
    const page = await op.search("plumber free tomorrow", { location: "78704", offset: 10 });
    assert.equal(page, PAGE);
    assert.match(await op.read("b1"), /^## Free tomorrow/);
    assert.deepEqual(
      api.calls.map((c) => `${c.method} ${c.path}`),
      ["GET /v1/beacons?q=plumber+free+tomorrow&location=78704&offset=10", "GET /v1/beacons/b1"],
    );
    assert.equal(api.calls[0].headers.Authorization, undefined);
    assert.equal(api.calls[0].headers.Accept, "text/markdown");
    assert.equal(await exists(join(home, ".config/openpath/credentials.json")), false);
  });

  it("sends a token it already has, and searches without it when it was revoked", async () => {
    const api = fakeApi();
    const { home, op } = await client(api);
    await op.myBeacons();
    await new Openpath({ fetch: api.fetch, env: {}, home }).search("movers");
    assert.equal(api.calls.at(-1).headers.Authorization, "Bearer agt_first");
    const stale = new Openpath({ fetch: api.fetch, env: {}, home: await mkdtemp(join(tmpdir(), "openpath-js-")), token: "agt_revoked" });
    assert.equal(await stale.search("movers"), PAGE);
    assert.equal(api.calls.at(-1).headers.Authorization, undefined);
    assert.equal(api.calls.filter((c) => c.path === "/v1/connect").length, 1);
  });

  it("uses OPENPATH_TOKEN before the saved token, and ignores the old name", async () => {
    const api = fakeApi();
    const home = await mkdtemp(join(tmpdir(), "openpath-js-"));
    await new Openpath({ fetch: api.fetch, env: { OPENPATH_TOKEN: "agt_env" }, home }).search("movers");
    assert.equal(api.calls[0].headers.Authorization, "Bearer agt_env");
    const old = fakeApi();
    await new Openpath({ fetch: old.fetch, env: { OPENPATH_AGENT_TOKEN: "agt_env" }, home: await mkdtemp(join(tmpdir(), "openpath-js-")) }).search("movers");
    assert.equal(old.calls[0].headers.Authorization, undefined);
  });
});

describe("connecting", () => {
  it("connects with no body on the first call that needs a token, saves it, and reuses it", async () => {
    const api = fakeApi();
    const { home, op } = await client(api);
    await op.myBeacons();
    const connect = api.calls[0];
    assert.equal(`${connect.method} ${connect.path}`, "POST /v1/connect");
    assert.equal(connect.body, undefined);
    assert.equal(connect.headers["Content-Type"], undefined);
    assert.equal(api.calls[1].headers.Authorization, "Bearer agt_first");
    const saved = JSON.parse(await readFile(join(home, ".config/openpath/credentials.json"), "utf8"));
    assert.deepEqual(Object.keys(saved["https://api.openpath.sh"]).sort(), ["agent_id", "connected_at", "token"]);
    await new Openpath({ fetch: api.fetch, env: {}, home }).myBeacons();
    assert.equal(api.calls.filter((c) => c.path === "/v1/connect").length, 1);
  });

  it("connects again once when its token was revoked", async () => {
    const api = fakeApi();
    const { op } = await client(api, { token: "agt_revoked" });
    await op.myBeacons();
    assert.deepEqual(
      api.calls.map((c) => `${c.method} ${c.path}`),
      ["GET /v1/me/beacons", "POST /v1/connect", "GET /v1/me/beacons"],
    );
  });
});

describe("a business's own beacons", () => {
  it("creates, renews, updates and deletes a beacon, with the fields the contract takes and no others", async () => {
    const api = fakeApi();
    const { op } = await client(api);
    const point = { lat: 30.2416, lng: -97.7695 };
    const created = await op.create("Free tomorrow 9–12 for leaks and clogs", { location: point, idempotencyKey: "k1" });
    assert.equal(created.beacon.id, "b1");
    assert.equal(created.beacon.mine.latest.revision, 1);
    const create = api.calls.at(-1);
    assert.equal(`${create.method} ${create.path}`, "POST /v1/beacons");
    assert.deepEqual(JSON.parse(create.body), { text: "Free tomorrow 9–12 for leaks and clogs", location: point });
    assert.equal(create.headers["Idempotency-Key"], "k1");
    await op.create("Remote bookkeeping help, evenings.");
    assert.deepEqual(JSON.parse(api.calls.at(-1).body), { text: "Remote bookkeeping help, evenings." });
    await op.create("Remote bookkeeping help, evenings.", { location: null });
    assert.deepEqual(JSON.parse(api.calls.at(-1).body), { text: "Remote bookkeeping help, evenings.", location: null });
    assert.throws(() => op.create("Free tomorrow", { location: "78704" }), TypeError);
    await op.renew("b1");
    assert.deepEqual([api.calls.at(-1).method, api.calls.at(-1).path, api.calls.at(-1).body], ["POST", "/v1/beacons/b1/renew", undefined]);
    await op.update("b1", { revision: 2, text: "Free tomorrow 10–12 only" });
    assert.deepEqual(
      [api.calls.at(-1).method, api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)],
      ["PUT", "/v1/beacons/b1", { revision: 2, text: "Free tomorrow 10–12 only" }],
    );
    await op.update("b1", { revision: 2, text: "Free tomorrow 10–12 only", location: point });
    assert.deepEqual(JSON.parse(api.calls.at(-1).body), { revision: 2, text: "Free tomorrow 10–12 only", location: point });
    await op.update("b1", { revision: 2, location: null });
    assert.deepEqual(JSON.parse(api.calls.at(-1).body), { revision: 2, location: null });
    await op.delete("b1");
    assert.deepEqual([api.calls.at(-1).method, api.calls.at(-1).path, api.calls.at(-1).body], ["DELETE", "/v1/beacons/b1", undefined]);
    await op.myBeacons();
    assert.equal(api.calls.at(-1).path, "/v1/me/beacons");
    await op.setTakingMessages(false);
    assert.deepEqual(
      [api.calls.at(-1).method, api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)],
      ["PUT", "/v1/me/messages", { taking_messages: false }],
    );
  });
});

describe("a beacon on the move", () => {
  it("sends only the location as a point with the revision, and renew can carry it too", async () => {
    const api = fakeApi();
    const { op } = await client(api);
    await op.updateLocation("b1", 30.2672, -97.7431, 3);
    assert.deepEqual(
      [api.calls.at(-1).method, api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)],
      ["PUT", "/v1/beacons/b1", { revision: 3, location: { lat: 30.2672, lng: -97.7431 } }],
    );
    await op.renew("b1", { location: { lat: 30.27, lng: -97.74 } });
    assert.deepEqual(
      [api.calls.at(-1).method, api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)],
      ["POST", "/v1/beacons/b1/renew", { location: { lat: 30.27, lng: -97.74 } }],
    );
    assert.equal(api.calls.at(-1).headers["Content-Type"], "application/json");
  });

  it("says how long to wait when it was sent sooner than 3 seconds", async () => {
    const api = fakeApi({
      refuse: () =>
        Response.json(
          { code: "rate_limited", detail: "This beacon’s location was updated less than 3 seconds ago.", next: "Send its location at most once every 3 seconds." },
          { status: 429, headers: { "Retry-After": "2" } },
        ),
    });
    const { op } = await client(api, { token: "agt_env" });
    await assert.rejects(op.updateLocation("b1", 30.2672, -97.7431, 3), (error) => {
      assert.ok(error instanceof OpenpathError);
      assert.equal(error.status, 429);
      assert.equal(error.code, "rate_limited");
      assert.equal(error.retryAfter, 2);
      return true;
    });
  });
});

describe("messages and conversations", () => {
  it("messages a beacon, lists and reads conversations, replies, marks the outcome and reports", async () => {
    const api = fakeApi();
    const { op } = await client(api);
    const sent = await op.message("b1", "Can you come at 10?");
    assert.equal(sent.conversation.id, "c1");
    assert.deepEqual([api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)], ["/v1/beacons/b1/messages", { text: "Can you come at 10?" }]);
    await op.conversations({ about: "my_beacons" });
    assert.equal(api.calls.at(-1).path, "/v1/me/conversations?about=my_beacons");
    await op.conversations();
    assert.equal(api.calls.at(-1).path, "/v1/me/conversations");
    await op.readConversation("c1");
    assert.equal(api.calls.at(-1).path, "/v1/conversations/c1");
    await op.reply("c1", "Yes, 10 works.");
    assert.deepEqual([api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)], ["/v1/conversations/c1/messages", { text: "Yes, 10 works." }]);
    await op.markOutcome("c1", "booked");
    assert.deepEqual(
      [api.calls.at(-1).method, api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)],
      ["PUT", "/v1/conversations/c1/outcome", { outcome: "booked" }],
    );
    await op.reportConversation("c1", "spam");
    assert.deepEqual([api.calls.at(-1).path, JSON.parse(api.calls.at(-1).body)], ["/v1/conversations/c1/report", { reason: "spam", block: true }]);
  });

  it("says why Beacon refused, what to do next, and how long to wait", async () => {
    const next = "Tell the person, and offer others.";
    const api = fakeApi({
      refuse: () =>
        Response.json(
          { code: "beacon_closed", detail: "This beacon expired: its creator didn’t renew it.", next },
          { status: 410, headers: { "Retry-After": "30" } },
        ),
    });
    const { op } = await client(api);
    await assert.rejects(op.message("b1", "Hi"), (error) => {
      assert.ok(error instanceof OpenpathError);
      assert.equal(error.status, 410);
      assert.equal(error.code, "beacon_closed");
      assert.equal(error.next, next);
      assert.equal(error.retryAfter, 30);
      assert.equal(error.message, `This beacon expired: its creator didn’t renew it. ${next}`);
      return true;
    });
  });

  it("names the app first in the User-Agent", async () => {
    const api = fakeApi();
    const { op } = await client(api, { app: "JobFinder/1.0" });
    await op.search("line cook jobs in Austin");
    assert.match(api.calls[0].headers["User-Agent"], /^JobFinder\/1\.0 openpath-js\/0\.1\.2/);
  });
});
