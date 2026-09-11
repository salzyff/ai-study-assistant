import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import router from "../src/routes/adminRoutes.js";
import { supabase } from "../src/supabase.js";
import { adminUserSummary } from "../src/utils/adminUsers.js";

const id = "12345678-1234-4234-8234-123456789abc";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const member = { id, email: "member@example.test", app_metadata: {}, user_metadata: { full_name: "Test member" } };
const notFound = { status: 404, code: "user_not_found" };

test("deleted rows are labelled clearly without displaying the anonymised email", () => {
  assert.equal(adminUserSummary(member, actorId).displayName, "Test member");
  const deleted = adminUserSummary({ ...member, email: "hashed-user-id", deleted_at: "2026-09-10T10:00:00Z" }, actorId);
  assert.equal(deleted.isDeleted, true);
  assert.equal(deleted.email, null);
  assert.equal(deleted.displayName, "Previously deleted account");
  assert.equal(deleted.id, id); // Retained internally to target the correct account.
});

test("permanent user deletion is protected, verified, idempotent and fails closed", async (t) => {
  const originals = { lookup: supabase.auth.admin.getUserById, remove: supabase.auth.admin.deleteUser, rpc: supabase.rpc };
  const priorAdmins = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "owner@example.test";
  let target, lookupError, readiness, deletionError, verificationError, keepAccount, removes;
  function reset() {
    target = structuredClone(member); lookupError = null; readiness = { data: true, error: null };
    deletionError = null; verificationError = null; keepAccount = false; removes = [];
  }
  reset();
  supabase.auth.admin.getUserById = async () => ({ data: { user: target }, error: removes.length ? verificationError || (!target ? notFound : null) : lookupError });
  supabase.auth.admin.deleteUser = async (...args) => {
    removes.push(args);
    if (!deletionError && !keepAccount) target = null;
    return { data: {}, error: deletionError };
  };
  supabase.rpc = async (name) => { assert.equal(name, "study_ai_user_deletion_ready"); return readiness; };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: req.headers["x-self"] ? id : actorId, app_metadata: { role: req.headers["x-role"] || "admin" } };
    next();
  });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const call = async (userId = id, headers = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/users/${userId}`, { method: "DELETE", headers });
    return { status: res.status, body: await res.json() };
  };
  try {
    await t.test("members cannot delete anyone", async () => {
      reset(); assert.equal((await call(id, { "x-role": "member" })).status, 403); assert.equal(removes.length, 0);
    });
    await t.test("invalid IDs do not reach deletion", async () => {
      reset(); assert.equal((await call("not-an-id")).status, 400); assert.equal(removes.length, 0);
    });
    await t.test("current account is protected", async () => {
      reset(); assert.equal((await call(id, { "x-self": "1" })).status, 400); assert.equal(removes.length, 0);
    });
    await t.test("original and promoted administrators are protected", async () => {
      reset(); target.email = "OWNER@example.test"; assert.equal((await call()).status, 403); assert.equal(removes.length, 0);
      reset(); target.app_metadata.role = "admin"; assert.equal((await call()).status, 403); assert.equal(removes.length, 0);
    });
    await t.test("uses false for a hard delete and confirms disappearance", async () => {
      reset(); const result = await call(); assert.equal(result.status, 200); assert.equal(result.body.deleted, true);
      assert.deepEqual(removes, [[id, false]]); assert.equal(target, null);
    });
    await t.test("old soft-deleted accounts can be permanently removed", async () => {
      reset(); target.deleted_at = "2026-09-10T00:00:00Z"; target.email = "hashed-user-id";
      assert.equal((await call()).body.deleted, true); assert.deepEqual(removes, [[id, false]]);
    });
    await t.test("missing cascade migration never starts deleting", async () => {
      for (const data of [false, null]) {
        reset(); readiness = { data, error: { code: "PGRST202" } };
        const result = await call(); assert.equal(result.status, 503); assert.equal(result.body.code, "DELETION_SETUP_REQUIRED"); assert.equal(removes.length, 0); assert.ok(target);
      }
    });
    await t.test("already removed account is an idempotent success", async () => {
      reset(); lookupError = notFound; target = null;
      assert.equal((await call()).body.deleted, true); assert.equal(removes.length, 0);
    });
    await t.test("lookup outage is not mistaken for a deleted account", async () => {
      reset(); lookupError = { status: 503 }; const result = await call();
      assert.equal(result.status, 500); assert.equal(result.body.deleted, undefined); assert.equal(removes.length, 0);
    });
    await t.test("constraint or storage failure does not claim success", async () => {
      reset(); deletionError = { status: 500, message: "fixture foreign key violation" };
      const result = await call(); assert.equal(result.status, 500); assert.equal(result.body.deleted, undefined); assert.ok(target);
    });
    await t.test("lingering user and verification outages do not claim success", async () => {
      reset(); keepAccount = true; assert.equal((await call()).status, 502);
      reset(); verificationError = { status: 503 }; assert.equal((await call()).status, 502);
    });
  } finally {
    supabase.auth.admin.getUserById = originals.lookup;
    supabase.auth.admin.deleteUser = originals.remove;
    supabase.rpc = originals.rpc;
    if (priorAdmins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = priorAdmins;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
