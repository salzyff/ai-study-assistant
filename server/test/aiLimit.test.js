import test from "node:test";
import assert from "node:assert/strict";
import { getDailyLimit } from "../src/middleware/aiUsage.js";
import { requireAdmin } from "../src/middleware/requireAdmin.js";

test("only trusted app metadata overrides daily allowance, including zero", () => {
  const baseline = getDailyLimit();
  assert.equal(getDailyLimit({ user_metadata: { ai_daily_limit: 9999 } }), baseline);
  assert.equal(getDailyLimit({ app_metadata: { ai_daily_limit: 0 } }), 0);
  assert.equal(getDailyLimit({ app_metadata: { ai_daily_limit: 200 } }), 200);
  for (const value of [null, -1, 1.5, "500", 10001]) {
    assert.equal(getDailyLimit({ app_metadata: { ai_daily_limit: value } }), baseline);
  }
});

test("admin guard denies member access to activity and allowance controls", () => {
  let status;
  let nextCalled = false;
  const res = { status(code) { status = code; return this; }, json(body) { return body; } };
  requireAdmin({ user: { app_metadata: {}, user_metadata: { role: "admin" } } }, res, () => { nextCalled = true; });
  assert.equal(status, 403);
  assert.equal(nextCalled, false);
});
