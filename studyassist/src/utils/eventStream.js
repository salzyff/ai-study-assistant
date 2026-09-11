// Parse complete SSE frames, even when UTF-8 or CRLF splits across network chunks.
export async function consumeEventStream(body, onEvent) {
  if (!body) throw new Error("Streaming is not supported by this browser");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  function processBlock(block) {
    let event = "message";
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    let data;
    try { data = JSON.parse(dataLines.join("\n")); }
    catch { throw new Error("The server sent an invalid chat response. Please retry."); }
    if (event === "error") throw new Error(data.error || "The AI stream was interrupted");
    if (event === "done") completed = true;
    onEvent?.(event, data);
  }

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let boundary;
      while (!completed && (boundary = /\r?\n\r?\n/.exec(buffer))) {
        processBlock(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (buffer.length > 2_000_000) throw new Error("The chat response is too large. Please try a shorter question.");
      if (done) {
        if (!completed && buffer.trim()) processBlock(buffer);
        break;
      }
    }
    if (!completed) throw new Error("The connection ended before the answer was saved. Reopen this chat to check it before retrying.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
