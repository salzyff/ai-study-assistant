import test from "node:test";
import assert from "node:assert/strict";
import { consumeEventStream } from "../src/utils/eventStream.js";

function stream(text, size = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
    controller.close();
  } });
}
test("SSE handles split UTF-8 and CRLF, heartbeat, and completion", async () => {
  const events = [];
  await consumeEventStream(stream(': keepalive\r\n\r\nevent: delta\r\ndata: {"text":"Hello 👋"}\r\n\r\nevent: done\r\ndata: {"messageId":"1"}\r\n\r\n'), (...e) => events.push(e));
  assert.deepEqual(events, [["delta", { text: "Hello 👋" }], ["done", { messageId: "1" }]]);
});
test("SSE handles LF and a final frame without a blank line", async () => {
  const events = [];
  await consumeEventStream(stream('event: done\ndata: {}', 1024), (...e) => events.push(e));
  assert.equal(events[0][0], "done");
});
test("an unfinished response is not reported as saved", async () => {
  await assert.rejects(consumeEventStream(stream('event: delta\ndata: {"text":"partial"}\n\n')), /before the answer was saved/);
});
test("server errors and invalid JSON reach the caller", async () => {
  await assert.rejects(consumeEventStream(stream('event: error\ndata: {"error":"Save failed"}\n\n')), /Save failed/);
  await assert.rejects(consumeEventStream(stream('event: delta\ndata: garbage\n\n')), /invalid chat response/);
});
test("no body gives a useful error", async () => {
  await assert.rejects(consumeEventStream(null), /not supported/);
});
