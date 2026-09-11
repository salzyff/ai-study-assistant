import test, { after, before } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
let server;
let baseUrl;

before(async () => {
  const { app } = await import("../src/server.js");
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health route returns JSON and a request id", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("x-request-id"));
  assert.deepEqual(await response.json(), { message: "Study AI backend is running" });
});

test("protected API routes reject missing authentication", async () => {
  const response = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Authentication required");
});

test("unknown public routes return a JSON 404", async () => {
  const response = await fetch(`${baseUrl}/not-a-route`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Route not found");
});

test("CORS rejects unapproved websites", async () => {
  const response = await fetch(`${baseUrl}/`, { headers: { Origin: "https://not-allowed.example" } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "This website is not allowed to access the API");
});

test("direct chat URLs load metadata only for the authenticated owner", async () => {
  const { supabase } = await import("../src/supabase.js");
  const originals = { getUser: supabase.auth.getUser, rpc: supabase.rpc, from: supabase.from };
  const uid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", sid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const cid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const token = `h.${Buffer.from(JSON.stringify({ sub: uid, session_id: sid })).toString("base64url")}.s`;
  const conversation = { id: cid, subject: "Biology", mode: "explain" };
  let owned = true, messagesRead = 0;
  supabase.auth.getUser = async () => ({ data: { user: { id: uid } }, error: null });
  supabase.rpc = async () => ({ data: true, error: null });
  supabase.from = (table) => {
    const filters = [];
    return {
      select() { return this; },
      eq(...filter) { filters.push(filter); return this; },
      async maybeSingle() {
        assert.equal(table, "conversations");
        assert.deepEqual(filters, [["id", cid], ["user_id", uid]]);
        return { data: owned ? conversation : null, error: null };
      },
      async order() {
        assert.equal(table, "messages"); messagesRead++;
        assert.deepEqual(filters, [["conversation_id", cid]]);
        return { data: [{ role: "assistant", content: "Owner's answer" }], error: null };
      },
    };
  };
  try {
    const url = `${baseUrl}/api/conversations/${cid}/messages`;
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200); assert.deepEqual((await response.json()).conversation, conversation);
    owned = false;
    const denied = await fetch(url, { headers });
    assert.equal(denied.status, 404); assert.equal(messagesRead, 1);
  } finally {
    supabase.auth.getUser = originals.getUser; supabase.rpc = originals.rpc; supabase.from = originals.from;
  }
});
