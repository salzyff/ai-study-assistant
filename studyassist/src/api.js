import { consumeEventStream } from "./utils/eventStream";

export const API_URL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

async function readResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The server returned an invalid response");
  }
}

export async function apiRequest(
  path,
  { accessToken, method = "GET", body, headers = {}, signal } = {},
) {
  const requestHeaders = new Headers(headers);

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  let requestBody = body;

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: requestBody,
    signal,
  });

  const data = await readResponse(response);
  if (response.status === 401 && data.code === "SESSION_ENDED") window.dispatchEvent(new Event("study-session-ended"));

  if (!response.ok) {
    const error = new Error(data.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function streamApiRequest(
  path,
  { accessToken, body, onEvent, signal } = {},
) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = await readResponse(response);
    if (response.status === 401 && data.code === "SESSION_ENDED") window.dispatchEvent(new Event("study-session-ended"));
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("The chat server returned an unexpected response. Check the backend connection.");
  await consumeEventStream(response.body, onEvent);
}
