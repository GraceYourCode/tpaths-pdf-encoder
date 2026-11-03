import assert from "node:assert/strict";
import { test } from "node:test";
import { isNavItemActive, NAV_ITEMS } from "./nav.ts";

test("NAV_ITEMS covers every implemented admin section", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.href),
    [
      "/",
      "/products",
      "/tokens",
      "/students",
      "/purchases",
      "/payments",
      "/licenses",
      "/audit-logs",
    ],
  );
});

test("every nav href is unique and starts with a slash", () => {
  const hrefs = NAV_ITEMS.map((i) => i.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const href of hrefs) assert.ok(href.startsWith("/"), href);
});

test("isNavItemActive matches the overview only exactly", () => {
  assert.equal(isNavItemActive("/", "/"), true);
  assert.equal(isNavItemActive("/products", "/"), false);
});

test("isNavItemActive matches a section and its children", () => {
  assert.equal(isNavItemActive("/products", "/products"), true);
  assert.equal(isNavItemActive("/products/123", "/products"), true);
  assert.equal(isNavItemActive("/students/abc", "/students"), true);
  // Must not match a sibling that merely shares a prefix.
  assert.equal(isNavItemActive("/products-archive", "/products"), false);
  assert.equal(isNavItemActive("/tokens", "/products"), false);
});
