export const CHAT_HISTORY_MESSAGE_LIMIT = 60;
export const CHAT_HISTORY_CHARACTER_LIMIT = 48_000;
const CHAT_HISTORY_MESSAGE_CHARACTER_LIMIT = 6_000;

export function formatConversationHistory(messages = []) {
  const kept = [];
  let remaining = CHAT_HISTORY_CHARACTER_LIMIT;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    const label = item?.role === "student" ? "Student" : "Assistant";
    const content = String(item?.content ?? "").trim();
    if (!content) continue;

    const separatorLength = kept.length ? 2 : 0;
    const available = remaining - separatorLength - label.length - 2;
    if (available <= 0) break;

    // Keep the end of oversized messages, where the student's latest request
    // or the answer's conclusion is most likely to contain the needed context.
    const clipped = content.length > CHAT_HISTORY_MESSAGE_CHARACTER_LIMIT
      ? content.slice(-Math.min(CHAT_HISTORY_MESSAGE_CHARACTER_LIMIT, available))
      : content.slice(-available);
    const formatted = `${label}: ${clipped}`;
    kept.unshift(formatted);
    remaining -= separatorLength + formatted.length;

    if (remaining <= 0) break;
  }

  return kept.join("\n\n");
}
