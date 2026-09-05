import test, { after, before } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
let server;
let baseUrl;

before(async () => {
  const { app } = await import("../src/server.js");
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health route returns JSON and a request id", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("x-request-id"));
  assert.deepEqual(await response.json(), { message: "Study AI backend is running" });
});

test("protected API routes reject missing authentication", async () => {
  const response = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Authentication required");
});

test("unknown public routes return a JSON 404", async () => {
  const response = await fetch(`${baseUrl}/not-a-route`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Route not found");
});

test("CORS rejects unapproved websites", async () => {
  const response = await fetch(`${baseUrl}/`, { headers: { Origin: "https://not-allowed.example" } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "This website is not allowed to access the API");
});
