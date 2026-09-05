import { integerField } from "./validation.js";

export function parsePagination(query, options = {}) {
  const defaultLimit = options.defaultLimit ?? 30;
  const maxLimit = options.maxLimit ?? 100;
  const limit = integerField(query.limit ?? defaultLimit, "limit", { min: 1, max: maxLimit });
  const offset = integerField(query.offset ?? 0, "offset", { min: 0, max: 100_000 });
  return { limit, offset, from: offset, to: offset + limit - 1 };
}

export function paginationResult({ limit, offset, count, returned }) {
  return {
    limit,
    offset,
    total: count ?? null,
    hasMore: count == null ? returned === limit : offset + returned < count,
    nextOffset: count == null
      ? (returned === limit ? offset + returned : null)
      : (offset + returned < count ? offset + returned : null),
  };
}
