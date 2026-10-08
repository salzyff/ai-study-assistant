import test from "node:test";
import assert from "node:assert/strict";
import { groupChatHistory, mergeChatHistory } from "../src/utils/chatHistory.js";

const now = new Date(2026, 9, 8, 19, 0);
const chat = (id, title, day, hour = 12) => ({ id, title, subject: "Biology", updated_at: new Date(2026, 9, day, hour).toISOString() });

test("history groups chats by local calendar days and sorts newest first", () => {
  const groups = groupChatHistory([
    chat("old", "Old lesson", 1), chat("yesterday", "Cells", 7),
    chat("first", "Photosynthesis", 8, 9), chat("latest", "Respiration", 8, 18),
    chat("month", "Genetics", -10),
  ], "", now);
  assert.deepEqual(groups.map(group => group.label), ["Today", "Yesterday", "Previous 7 days", "Previous 30 days"]);
  assert.deepEqual(groups[0].conversations.map(item => item.id), ["latest", "first"]);
});

test("search is case insensitive and includes older loaded chats", () => {
  const groups = groupChatHistory([chat("a", "Cells", 8), chat("b", "Photosynthesis", 1)], "  PHOTOSYNTHESIS  ", now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].conversations[0].id, "b");
});

test("overlapping history pages do not duplicate chats and updates replace metadata", () => {
  const current = [chat("a", "First title", 7), chat("b", "Older topic", 1)];
  const merged = mergeChatHistory(current, [chat("a", "Updated title", 8), chat("c", "Another topic", 2)]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].title, "Updated title");
  assert.deepEqual(merged.map(item => item.id), ["a", "c", "b"]);
});
