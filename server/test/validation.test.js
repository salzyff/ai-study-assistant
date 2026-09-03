import test from "node:test";
import assert from "node:assert/strict";
import {
  RequestValidationError,
  enumField,
  integerField,
  stringField,
  uuidField,
} from "../src/utils/validation.js";

test("stringField trims valid text", () => {
  assert.equal(stringField("  Biology  ", "subject", { max: 20 }), "Biology");
});

test("stringField rejects oversized input", () => {
  assert.throws(
    () => stringField("abcdef", "topic", { max: 5 }),
    RequestValidationError,
  );
});

test("integerField enforces its range", () => {
  assert.equal(integerField("10", "count", { min: 5, max: 20 }), 10);
  assert.throws(
    () => integerField(50, "count", { min: 5, max: 20 }),
    RequestValidationError,
  );
});

test("enumField accepts only known values", () => {
  assert.equal(enumField("good", "rating", ["again", "hard", "good", "easy"]), "good");
  assert.throws(
    () => enumField("perfect", "rating", ["again", "hard", "good", "easy"]),
    RequestValidationError,
  );
});

test("uuidField validates identifiers", () => {
  assert.equal(
    uuidField("123e4567-e89b-42d3-a456-426614174000", "noteId"),
    "123e4567-e89b-42d3-a456-426614174000",
  );
  assert.throws(() => uuidField("not-an-id", "noteId"), RequestValidationError);
});
