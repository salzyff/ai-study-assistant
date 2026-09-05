import assert from "node:assert/strict";
import test from "node:test";
import { adminUserProtectionReason, isAdminUser, isEnvironmentAdmin } from "../src/middleware/requireAdmin.js";
import { getRecentLogs, logger } from "../src/utils/logger.js";

test("isAdminUser accepts an app metadata administrator", () => {
  assert.equal(isAdminUser({ app_metadata: { role: "admin" }, email: "student@example.com" }), true);
});

test("isAdminUser rejects a normal account", () => {
  assert.equal(isAdminUser({ app_metadata: {}, email: "student@example.com" }), false);
});

test("structured logger keeps a bounded recent view", () => {
  logger.info("admin_test_event", { status: 200 });
  const [entry] = getRecentLogs(1);
  assert.equal(entry.message, "admin_test_event");
  assert.equal(entry.status, 200);
});

test("admin user management protects the signed-in account", () => {
  assert.equal(
    adminUserProtectionReason({ id: "user-1", app_metadata: {} }, "user-1"),
    "You cannot manage your own account here",
  );
});

test("admin user management protects other administrators", () => {
  assert.equal(
    adminUserProtectionReason({ id: "user-2", app_metadata: { role: "admin" } }, "user-1"),
    "Administrator accounts are protected",
  );
});

test("environment administrators are recognized regardless of email casing", () => {
  const previous = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = " owner@example.com,SECOND@example.com ";
  try {
    assert.equal(isEnvironmentAdmin({ email: "OWNER@EXAMPLE.COM" }), true);
    assert.equal(isEnvironmentAdmin({ email: "member@example.com" }), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previous;
  }
});
