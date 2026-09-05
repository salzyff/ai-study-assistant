import test from "node:test";
import assert from "node:assert/strict";
import { inspectStudyUpload } from "../src/utils/fileSecurity.js";

test("accepts a normal text study file", () => {
  const result = inspectStudyUpload({
    originalname: "biology.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("Photosynthesis converts light energy into chemical energy."),
  });
  assert.equal(result.safe, true);
});

test("rejects mismatched extensions", () => {
  const result = inspectStudyUpload({ originalname: "notes.exe", mimetype: "text/plain", buffer: Buffer.from("notes") });
  assert.equal(result.safe, false);
});

test("rejects PDF active content", () => {
  const result = inspectStudyUpload({
    originalname: "notes.pdf",
    mimetype: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 /OpenAction /JavaScript"),
  });
  assert.equal(result.safe, false);
});
