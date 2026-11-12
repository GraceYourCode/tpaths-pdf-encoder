import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "../safe-next.ts";

test("safeNext allows same-site absolute paths", () => {
  assert.equal(safeNext("/dashboard/library"), "/dashboard/library");
  assert.equal(safeNext("/checkout/abc?x=1"), "/checkout/abc?x=1");
});

test("safeNext rejects open-redirect vectors and falls back", () => {
  assert.equal(safeNext("//evil.example"), "/dashboard");
  assert.equal(safeNext("/\\evil.example"), "/dashboard");
  assert.equal(safeNext("https://evil.example"), "/dashboard");
  assert.equal(safeNext("javascript:alert(1)"), "/dashboard");
  assert.equal(safeNext(undefined), "/dashboard");
  assert.equal(safeNext("", "/store"), "/store");
});
