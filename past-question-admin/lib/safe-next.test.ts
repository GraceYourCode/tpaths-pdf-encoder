import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safe-next.ts";

test("safeNext allows only same-site absolute paths", () => {
  assert.equal(safeNext("/products"), "/products");
  assert.equal(safeNext("/products?page=2"), "/products?page=2");
  assert.equal(safeNext("/ok", "/home"), "/ok");
});

test("safeNext rejects open-redirect vectors", () => {
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("/path\\with\\backslash"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("relative/path"), "/");
});

test("safeNext falls back for empty / non-string input", () => {
  assert.equal(safeNext(""), "/");
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(undefined), "/");
  assert.equal(safeNext(42), "/");
  assert.equal(safeNext("bad", "/home"), "/home");
});
