import test from "node:test";
import assert from "node:assert/strict";
import { authRedirect, normalizePath, resolveRoute, toolPath, ADMIN_SECTIONS } from "../src/utils/routes.js";

test("successful login and OAuth return leave public URLs for /home", () => {
  for (const path of ["/", "/login", "/register", "/forgot-password"]) assert.equal(authRedirect(path, true), "/home");
  assert.equal(authRedirect("/home", true), null);
});
test("signed-out users cannot keep private URLs", () => {
  for (const path of ["/home", "/chat", "/admin/users", "/profile"]) assert.equal(authRedirect(path, false), "/login");
  assert.equal(authRedirect("/login", false), null);
});
test("password recovery is not redirected into the ordinary app", () => {
  assert.equal(authRedirect("/", true, true), "/reset-password");
  assert.equal(authRedirect("/reset-password", true, true), null);
  assert.equal(authRedirect("/reset-password", false), null);
});
test("every study tool and admin tab has its own round-trip URL", () => {
  for (const tool of [null, "chat", "quiz", "task", "plan", "notes", "flashcards", "progress", "dashboard", "learning", "reports", "profile", "change-password"]) {
    assert.equal(resolveRoute(toolPath(tool)).tool, tool);
  }
  for (const [section, path] of Object.entries(ADMIN_SECTIONS)) {
    assert.equal(resolveRoute(path).section, section);
    assert.equal(resolveRoute(path).admin, true);
  }
});
test("chat URLs identify the conversation after refresh", () => {
  const id = "12345678-1234-4234-8234-123456789abc";
  assert.equal(resolveRoute(toolPath("chat", id)).sessionId, id);
  assert.equal(resolveRoute(`/chat/${id.toUpperCase()}`).sessionId, id);
  assert.equal(resolveRoute("/chat").sessionId, null);
});
test("invalid and prototype names do not become routes", () => {
  for (const path of ["/nope", "/chat/undefined", "/chat/not-an-id", "constructor", "__proto__", "//other.example"]) assert.equal(resolveRoute(path), null);
  assert.equal(normalizePath("/admin/users/"), "/admin/users");
  assert.equal(resolveRoute("/home/").tool, null);
});
