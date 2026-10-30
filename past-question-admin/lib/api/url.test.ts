import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUrl, serializeQuery } from "./url.ts";

test("serializeQuery omits empty values and prefixes '?'", () => {
  assert.equal(
    serializeQuery({ a: 1, b: undefined, c: null, d: "", e: "x" }),
    "?a=1&e=x",
  );
  assert.equal(serializeQuery({}), "");
  assert.equal(serializeQuery({ page: 2, status: "active" }), "?page=2&status=active");
});

test("buildUrl strips trailing slashes and normalises the path", () => {
  assert.equal(
    buildUrl("http://x/api/v1/", "/products", { page: 2, search: "a" }),
    "http://x/api/v1/products?page=2&search=a",
  );
  assert.equal(buildUrl("http://x", "products"), "http://x/products");
  assert.equal(buildUrl("http://x/", "/health"), "http://x/health");
  // No query object → no trailing "?".
  assert.equal(buildUrl("http://x/api", "/a"), "http://x/api/a");
});
