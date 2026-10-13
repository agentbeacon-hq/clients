import assert from "node:assert/strict";
import { test } from "node:test";
import { openpathTools, readListing, searchListings } from "../index.js";

/** A stand-in client that records what the tools ask it. */
function fakeClient() {
  const calls = [];
  return {
    calls,
    search: async (query, options) => {
      calls.push(["search", query, options]);
      return `# Results for "${query}"`;
    },
    getListing: async (id) => {
      calls.push(["getListing", id]);
      return `# Listing ${id}`;
    },
  };
}

const context = { toolCallId: "call-1", messages: [] };

test("search passes the query and its options to Openpath", async () => {
  const client = fakeClient();
  const search = searchListings({ client });
  assert.match(search.description, /Use this when/);
  const out = await search.execute({ query: "plumber near Austin, TX", near: "78701" }, context);
  assert.equal(out, '# Results for "plumber near Austin, TX"');
  assert.deepEqual(client.calls, [["search", "plumber near Austin, TX", { near: "78701", domain: undefined }]]);
});

test("the search input is checked: a query, a known domain", () => {
  const schema = searchListings({ client: fakeClient() }).inputSchema;
  assert.equal(schema.safeParse({ query: "jobs in Austin", domain: "work" }).success, true);
  assert.equal(schema.safeParse({ query: "" }).success, false);
  assert.equal(schema.safeParse({ query: "jobs", domain: "weather" }).success, false);
});

test("reading a listing asks for it by id", async () => {
  const client = fakeClient();
  const out = await readListing({ client }).execute({ id: "abc" }, context);
  assert.equal(out, "# Listing abc");
  assert.deepEqual(client.calls, [["getListing", "abc"]]);
});

test("both tools share one client", async () => {
  const client = fakeClient();
  const tools = openpathTools({ client });
  await tools.searchListings.execute({ query: "tacos in Austin" }, context);
  await tools.readListing.execute({ id: "x" }, context);
  assert.equal(client.calls.length, 2);
});
