import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createAiConcurrencyLimiter } from "../src/middleware/aiConcurrency.js";

function response() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.setHeader = () => {};
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

test("limits one active AI request per student and releases after response", () => {
  const limiter = createAiConcurrencyLimiter({ maxConcurrent: 2 });
  const first = response();
  let nextCalls = 0;
  limiter({ user: { id: "student-1" } }, first, () => { nextCalls += 1; });

  const duplicate = response();
  limiter({ user: { id: "student-1" } }, duplicate, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(duplicate.statusCode, 429);

  first.emit("finish");
  const retry = response();
  limiter({ user: { id: "student-1" } }, retry, () => { nextCalls += 1; });
  assert.equal(nextCalls, 2);
});

test("limits total in-flight AI requests without mixing up students", () => {
  const limiter = createAiConcurrencyLimiter({ maxConcurrent: 1 });
  const first = response();
  limiter({ user: { id: "student-1" } }, first, () => {});
  const second = response();
  limiter({ user: { id: "student-2" } }, second, () => {});
  assert.equal(second.statusCode, 429);
});
