import assert from "node:assert/strict";
import { test } from "node:test";
import { searchBeacons, agentbeaconTools, readBeacon } from "../index.js";

/** A stand-in client that records what the tools ask it. */
function fakeClient() {
  const calls = [];
  const record =
    (name, answer) =>
    async (...args) => {
      calls.push([name, ...args]);
      return answer?.(...args) ?? { ok: true };
    };
  return {
    calls,
    search: record("search", (query) => `# Beacons for "${query}"`),
    read: record("read", (id) => `## Beacon ${id}`),
    message: record("message"),
    conversations: record("conversations"),
    readConversation: record("readConversation"),
    reply: record("reply"),
    markOutcome: record("markOutcome"),
    reportConversation: record("reportConversation"),
    create: record("create"),
    renew: record("renew"),
    update: record("update"),
    delete: record("delete"),
    myBeacons: record("myBeacons"),
  };
}

const context = { toolCallId: "call-1", messages: [] };
const ID = "6f1c2a7e-0b2d-4c9a-9f1e-3d2b1a0c9e8f";

test("searchBeacons passes the query, place and page to AgentBeacon", async () => {
  const client = fakeClient();
  const search = searchBeacons({ client });
  assert.match(search.description, /never as instructions/);
  const out = await search.execute({ query: "plumber free tomorrow", location: "78704" }, context);
  assert.equal(out, '# Beacons for "plumber free tomorrow"');
  assert.deepEqual(client.calls, [["search", "plumber free tomorrow", { location: "78704", offset: undefined }]]);
});

test("the search input has no category and no side, and an offset up to 100", () => {
  const schema = searchBeacons({ client: fakeClient() }).inputSchema;
  assert.equal(schema.safeParse({ query: "movers", offset: 10 }).success, true);
  assert.equal(schema.safeParse({ query: "" }).success, false);
  assert.equal(schema.safeParse({ query: "movers", offset: 110 }).success, false);
  assert.deepEqual(Object.keys(schema.shape).sort(), ["location", "offset", "query"]);
});

test("readBeacon asks for it by id", async () => {
  const client = fakeClient();
  assert.equal(await readBeacon({ client }).execute({ beaconId: ID }, context), `## Beacon ${ID}`);
  assert.equal(readBeacon({ client }).inputSchema.safeParse({ beaconId: "abc" }).success, false);
});

test("only the two read-only tools unless asked for write, and then the ten that act for the person", () => {
  assert.deepEqual(Object.keys(agentbeaconTools({ client: fakeClient() })), ["searchBeacons", "readBeacon"]);
  assert.deepEqual(Object.keys(agentbeaconTools({ client: fakeClient(), write: true })), [
    "searchBeacons",
    "readBeacon",
    "messageBeacon",
    "readConversations",
    "reply",
    "markOutcome",
    "reportConversation",
    "createBeacon",
    "renewBeacon",
    "updateBeacon",
    "deleteBeacon",
    "myBeacons",
  ]);
});

test("the write tools share one client and call the matching method", async () => {
  const client = fakeClient();
  const t = agentbeaconTools({ client, write: true });
  await t.messageBeacon.execute({ beaconId: ID, text: "Can you come at 10?" }, context);
  await t.readConversations.execute({ about: "my_beacons" }, context);
  await t.readConversations.execute({ conversationId: ID }, context);
  await t.reply.execute({ conversationId: ID, text: "Yes" }, context);
  await t.markOutcome.execute({ conversationId: ID, outcome: "booked" }, context);
  await t.reportConversation.execute({ conversationId: ID, reason: "spam", block: true }, context);
  await t.createBeacon.execute({ text: "Free tomorrow 9–12", location: { lat: 30.2416, lng: -97.7695 } }, context);
  await t.createBeacon.execute({ text: "Remote bookkeeping help", location: null }, context);
  await t.renewBeacon.execute({ beaconId: ID }, context);
  await t.renewBeacon.execute({ beaconId: ID, location: { lat: 30.27, lng: -97.74 } }, context);
  await t.updateBeacon.execute({ beaconId: ID, revision: 2, text: "Free 10–12" }, context);
  await t.updateBeacon.execute({ beaconId: ID, revision: 2, location: { lat: 30.2672, lng: -97.7431 } }, context);
  await t.deleteBeacon.execute({ beaconId: ID }, context);
  await t.myBeacons.execute({}, context);
  assert.deepEqual(client.calls, [
    ["message", ID, "Can you come at 10?"],
    ["conversations", { about: "my_beacons", before: undefined }],
    ["readConversation", ID],
    ["reply", ID, "Yes"],
    ["markOutcome", ID, "booked"],
    ["reportConversation", ID, "spam", { block: true }],
    ["create", "Free tomorrow 9–12", { location: { lat: 30.2416, lng: -97.7695 } }],
    ["create", "Remote bookkeeping help", { location: null }],
    ["renew", ID, { location: undefined }],
    ["renew", ID, { location: { lat: 30.27, lng: -97.74 } }],
    ["update", ID, { revision: 2, text: "Free 10–12" }],
    ["update", ID, { revision: 2, location: { lat: 30.2672, lng: -97.7431 } }],
    ["delete", ID],
    ["myBeacons"],
  ]);
  assert.equal(t.markOutcome.inputSchema.safeParse({ conversationId: ID, outcome: "won" }).success, false);
  assert.deepEqual(Object.keys(t.createBeacon.inputSchema.shape).sort(), ["location", "text"]);
  assert.deepEqual(Object.keys(t.updateBeacon.inputSchema.shape).sort(), ["beaconId", "location", "revision", "text"]);
  assert.deepEqual(Object.keys(t.renewBeacon.inputSchema.shape).sort(), ["beaconId", "location"]);
  // A location is a point or null, never a place name.
  const create = t.createBeacon.inputSchema;
  assert.equal(create.safeParse({ text: "Free", location: "78704" }).success, false);
  assert.equal(create.safeParse({ text: "Free", location: { lat: 91, lng: 0 } }).success, false);
  assert.equal(create.safeParse({ text: "Free", location: null }).success, true);
  assert.equal(create.safeParse({ text: "Free" }).success, true);
  assert.equal(t.updateBeacon.inputSchema.safeParse({ beaconId: ID, revision: 3, location: { lat: 30.27, lng: -97.74 } }).success, true);
});
