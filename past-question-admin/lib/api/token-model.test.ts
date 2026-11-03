import assert from "node:assert/strict";
import { test } from "node:test";
import { filterAndPaginateTokens, mapToken, maskTokenId } from "./token-model.ts";
import type { AccessToken } from "./types.ts";

const tok = (id: string, over: Partial<AccessToken> = {}): AccessToken => ({
  id, maskedCode: maskTokenId(id), productId: "p1", status: "active",
  createdAt: "2026-01-01", ...over,
});

test("token status maps UNUSED and ACTIVE to active, others lowercased", () => {
  const base = { id: "t1", productId: "p1", createdAt: "2026-01-01" };
  assert.equal(mapToken({ ...base, status: "UNUSED" }).status, "active");
  assert.equal(mapToken({ ...base, status: "ACTIVE" }).status, "active");
  assert.equal(mapToken({ ...base, status: "SUSPENDED" }).status, "suspended");
  assert.equal(mapToken({ ...base, status: "REVOKED" }).status, "revoked");
  assert.equal(mapToken({ ...base, status: "EXPIRED" }).status, "expired");
});

test("the display mask never contains more than the last six id characters", () => {
  const masked = maskTokenId("cuid-abcdef-1234567");
  assert.equal(masked, "Token •••• 234567");
  assert.equal(masked.includes("cuid"), false);
});

test("pagination slices the filtered set and reports the true total", () => {
  const all = Array.from({ length: 45 }, (_, i) => tok(`t${i}`));
  const page1 = filterAndPaginateTokens(all, { page: 1, pageSize: 20 });
  const page3 = filterAndPaginateTokens(all, { page: 3, pageSize: 20 });
  assert.equal(page1.items.length, 20);
  assert.equal(page3.items.length, 5, "the last page holds the remainder");
  assert.equal(page1.total, 45);
  assert.equal(page1.totalPages, 3);
});

test("a page past the end is empty instead of repeating earlier rows", () => {
  const all = Array.from({ length: 5 }, (_, i) => tok(`t${i}`));
  const beyond = filterAndPaginateTokens(all, { page: 4, pageSize: 20 });
  assert.equal(beyond.items.length, 0);
  assert.equal(beyond.total, 5);
});

test("status and product filters apply before paging, so totals match what is shown", () => {
  const all = [
    tok("a", { status: "active", productId: "p1" }),
    tok("b", { status: "revoked", productId: "p1" }),
    tok("c", { status: "active", productId: "p2" }),
    tok("d", { status: "active", productId: "p1" }),
  ];
  const byStatus = filterAndPaginateTokens(all, { status: "active", pageSize: 20 });
  assert.deepEqual(byStatus.items.map((t) => t.id), ["a", "c", "d"]);
  const byBoth = filterAndPaginateTokens(all, { status: "active", productId: "p1", pageSize: 20 });
  assert.deepEqual(byBoth.items.map((t) => t.id), ["a", "d"]);
  assert.equal(byBoth.total, 2);
});

test("an empty token list still reports one page", () => {
  const empty = filterAndPaginateTokens([], { page: 1, pageSize: 20 });
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.total, 0);
});
