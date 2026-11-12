import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordProblem } from "../password.ts";

test("passwordProblem accepts a policy-compliant password", () => {
  assert.equal(passwordProblem("ExamplePassword123"), null);
});

test("passwordProblem reports short and weak passwords", () => {
  assert.match(passwordProblem("Short1") ?? "", /at least 12/);
  assert.match(passwordProblem("alllowercase123") ?? "", /uppercase/);
  assert.match(passwordProblem("NoDigitsHereAtAll") ?? "", /number/);
});
