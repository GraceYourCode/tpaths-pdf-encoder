import assert from "node:assert/strict";
import { test } from "node:test";
import { firstStr, toPageNumber } from "./query.ts";

test("toPageNumber accepts positive integers, falls back to 1 otherwise", () => {
  assert.equal(toPageNumber("3"), 3);
  assert.equal(toPageNumber("1"), 1);
  assert.equal(toPageNumber("0"), 1);
  assert.equal(toPageNumber("-2"), 1);
  assert.equal(toPageNumber("abc"), 1);
  assert.equal(toPageNumber(undefined), 1);
  assert.equal(toPageNumber(["5", "6"]), 5);
  assert.equal(toPageNumber("2.9"), 2);
});

test("firstStr coerces arrays and undefined to a string", () => {
  assert.equal(firstStr("x"), "x");
  assert.equal(firstStr(["a", "b"]), "a");
  assert.equal(firstStr(undefined), "");
  assert.equal(firstStr([]), "");
});
