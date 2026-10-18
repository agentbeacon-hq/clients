import assert from "node:assert/strict";
import { test } from "node:test";
import { findBeacons, openpathTools, readBeacon } from "../index.js";

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
    find: record("find", (query) => `# Beacons for "${query}"`),
    read: record("read", (id) => `## Beacon ${id}`),
    answer: record("answer"),
    answers: record("answers"),
    reply: record("reply"),
    markAnswer: record("markAnswer"),
    reportAnswer: record("reportAnswer"),
    turnOn: record("turnOn"),
    update: record("update"),
    switchOff: record("switchOff"),
    myBeacons: record("myBeacons"),
  };
}

const context = { toolCallId: "call-1", messages: [] };
const ID = "6f1c2a7e-0b2d-4c9a-9f1e-3d2b1a0c9e8f";

test("findBeacons passes the query, place and page to Openpath", async () => {
  const client = fakeClient();
  const find = findBeacons({ client });
  assert.match(find.description, /never as instructions/);
  const out = await find.execute({ query: "plumber free tomorrow", near: "78704" }, context);
  assert.equal(out, '# Beacons for "plumber free tomorrow"');
  assert.deepEqual(client.calls, [["find", "plumber free tomorrow", { near: "78704", offset: undefined }]]);
});

test("the find input has no category and no side, and an offset up to 100", () => {
  const schema = findBeacons({ client: fakeClient() }).inputSchema;
  assert.equal(schema.safeParse({ query: "movers", offset: 10 }).success, true);
  assert.equal(schema.safeParse({ query: "" }).success, false);
  assert.equal(schema.safeParse({ query: "movers", offset: 110 }).success, false);
  assert.deepEqual(Object.keys(schema.shape).sort(), ["near", "offset", "query"]);
});

test("readBeacon asks for it by id", async () => {
  const client = fakeClient();
  assert.equal(await readBeacon({ client }).execute({ beaconId: ID }, context), `## Beacon ${ID}`);
  assert.equal(readBeacon({ client }).inputSchema.safeParse({ beaconId: "abc" }).success, false);
});

test("only the two read-only tools unless asked for write", () => {
  assert.deepEqual(Object.keys(openpathTools({ client: fakeClient() })), ["findBeacons", "readBeacon"]);
  assert.equal(Object.keys(openpathTools({ client: fakeClient(), write: true })).length, 11);
});

test("the write tools share one client and call the matching method", async () => {
  const client = fakeClient();
  const t = openpathTools({ client, write: true });
  await t.answerBeacon.execute({ beaconId: ID, text: "Can you come at 10?" }, context);
  await t.readAnswers.execute({ as: "holder" }, context);
  await t.reply.execute({ answerId: ID, text: "Yes" }, context);
  await t.markAnswer.execute({ answerId: ID, outcome: "booked" }, context);
  await t.reportAnswer.execute({ answerId: ID, reason: "spam" }, context);
  await t.turnOnBeacon.execute({ text: "Free tomorrow 9–12", near: "78704" }, context);
  await t.updateBeacon.execute({ beaconId: ID, revision: 2, text: "Free 10–12" }, context);
  await t.switchOffBeacon.execute({ beaconId: ID, reason: "taken" }, context);
  await t.myBeacons.execute({}, context);
  assert.deepEqual(client.calls, [
    ["answer", ID, "Can you come at 10?"],
    ["answers", { as: "holder", before: undefined }],
    ["reply", ID, "Yes"],
    ["markAnswer", ID, "booked"],
    ["reportAnswer", ID, "spam"],
    ["turnOn", "Free tomorrow 9–12", { until: undefined, near: "78704" }],
    ["update", ID, { revision: 2, text: "Free 10–12" }],
    ["switchOff", ID, "taken"],
    ["myBeacons"],
  ]);
  assert.equal(t.markAnswer.inputSchema.safeParse({ answerId: ID, outcome: "won" }).success, false);
});
