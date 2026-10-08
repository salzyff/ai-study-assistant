import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_HISTORY_CHARACTER_LIMIT,
  CHAT_HISTORY_MESSAGE_LIMIT,
  formatConversationHistory,
} from "../src/utils/conversationMemory.js";

test("chat history window includes up to 30 turns in chronological order", () => {
  const messages = Array.from({ length: CHAT_HISTORY_MESSAGE_LIMIT }, (_, index) => ({
    role: index % 2 === 0 ? "student" : "assistant",
    content: `message ${index + 1}`,
  }));

  const history = formatConversationHistory(messages);

  assert.match(history, /^Student: message 1/);
  assert.match(history, /Assistant: message 60$/);
  assert.equal(history.split("\n\n").length, CHAT_HISTORY_MESSAGE_LIMIT);
});

test("chat history stays within its character budget and favors recent messages", () => {
  const messages = Array.from({ length: 80 }, (_, index) => ({
    role: index % 2 === 0 ? "student" : "assistant",
    content: `message ${index + 1} ${"x".repeat(900)}`,
  }));

  const history = formatConversationHistory(messages);

  assert.ok(history.length <= CHAT_HISTORY_CHARACTER_LIMIT);
  assert.match(history, /message 80/);
  assert.doesNotMatch(history, /message 1 /);
});

test("oversized messages keep their endings", () => {
  const history = formatConversationHistory([
    { role: "student", content: `${"x".repeat(7000)} IMPORTANT LAST DETAIL` },
  ]);

  assert.match(history, /IMPORTANT LAST DETAIL$/);
  assert.ok(history.length <= CHAT_HISTORY_CHARACTER_LIMIT);
});
