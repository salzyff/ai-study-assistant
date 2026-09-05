import test from "node:test";
import assert from "node:assert/strict";
import { paginationResult, parsePagination } from "../src/utils/pagination.js";

test("parses safe pagination ranges", () => {
  assert.deepEqual(parsePagination({ limit: "20", offset: "40" }), {
    limit: 20,
    offset: 40,
    from: 40,
    to: 59,
  });
});

test("builds a next offset when results remain", () => {
  assert.deepEqual(paginationResult({ limit: 20, offset: 40, count: 65, returned: 20 }), {
    limit: 20,
    offset: 40,
    total: 65,
    hasMore: true,
    nextOffset: 60,
  });
});
