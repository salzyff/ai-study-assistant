import test from "node:test";
import assert from "node:assert/strict";
import { rememberRecovery, hasRecovery, clearRecovery } from "../src/utils/passwordRecovery.js";

function storage() {
  let value;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, removeItem: () => { value = null; } };
}
test("recovery-page state survives refresh only for the same account", () => {
  const saved = storage(); rememberRecovery("student-a", saved);
  assert.equal(hasRecovery("student-a", saved), true);
  assert.equal(hasRecovery("student-b", saved), false);
  clearRecovery(saved); assert.equal(hasRecovery("student-a", saved), false);
});
test("expired or malformed page state cannot trap a user in recovery", () => {
  const saved = storage(); saved.setItem("", JSON.stringify({userId:"a",expiresAt:Date.now()-1}));
  assert.equal(hasRecovery("a", saved), false);
  saved.setItem("", "not-json"); assert.equal(hasRecovery("a", saved), false);
  assert.equal(hasRecovery(null, saved), false);
});
test("unavailable storage does not crash recovery", () => {
  const blocked = { setItem(){throw new Error("blocked");},getItem(){throw new Error("blocked");},removeItem(){throw new Error("blocked");} };
  assert.doesNotThrow(()=>rememberRecovery("a", blocked));
  assert.equal(hasRecovery("a", blocked), false);
  assert.doesNotThrow(()=>clearRecovery(blocked));
});
