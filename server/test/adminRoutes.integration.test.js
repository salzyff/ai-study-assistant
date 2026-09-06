import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/routes/adminRoutes.js";
import { supabase } from "../src/supabase.js";

test("admin routes enforce access, validate filters and limits, protect owner", async () => {
  const originalLookup = supabase.auth.admin.getUserById;
  const originalUpdate = supabase.auth.admin.updateUserById;
  const originalFrom = supabase.from;
  const previousAdmins = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "owner@example.com";
  const id = "12345678-1234-4234-8234-123456789abc";
  const updates = [];
  const filters = [];
  supabase.auth.admin.getUserById = async () => ({ data: { user: { id, email: "owner@example.com", app_metadata: {} } }, error: null });
  supabase.auth.admin.updateUserById = async (...args) => { updates.push(args); return { data: {}, error: null }; };
  supabase.from = () => {
    const query = { select() { return this; }, eq(...args) { filters.push(args); return this; }, order() { return this; }, range() { return Promise.resolve({ data: [], count: 0, error: null }); } };
    return query;
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers["x-own"] ? id : "another-admin", app_metadata: { role: req.headers["x-role"] || "member" } }; next(); });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const call = (path, body, role = "admin", own = false) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: body === undefined ? "GET" : "PATCH", headers: { "content-type": "application/json", "x-role": role, ...(own ? { "x-own": "1" } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    assert.equal((await call("/activity", undefined, "member")).status, 403);
    assert.equal((await call(`/users/${id}/limit`, { limit: 100 }, "member")).status, 403);
    assert.equal((await call("/jobs?status=invalid")).status, 400);
    assert.equal((await call("/activity?userId=invalid")).status, 400);
    assert.equal((await call("/jobs?status=failed")).status, 200);
    assert.equal((await call("/jobs?status=processing")).status, 200);
    assert.equal((await call("/jobs?status=running")).status, 400);
    assert.ok(filters.some(([key, value]) => key === "status" && value === "failed"));
    assert.equal((await call(`/activity?userId=${id}`)).status, 200);
    assert.ok(filters.some(([key, value]) => key === "user_id" && value === id));
    for (const limit of [-1, 0.5, "100", 10001]) assert.equal((await call(`/users/${id}/limit`, { limit })).status, 400);
    assert.equal((await call(`/users/${id}/limit`, { limit: 0 })).status, 403);
    assert.equal(updates.length, 0);
    assert.equal((await call(`/users/${id}/limit`, { limit: 0 }, "admin", true)).status, 200);
    assert.deepEqual(updates.at(-1)[1], { app_metadata: { ai_daily_limit: 0 } });
    assert.equal((await call(`/users/${id}/limit`, { limit: null }, "admin", true)).status, 200);
  } finally {
    supabase.auth.admin.getUserById = originalLookup;
    supabase.auth.admin.updateUserById = originalUpdate;
    supabase.from = originalFrom;
    if (previousAdmins === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previousAdmins;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
