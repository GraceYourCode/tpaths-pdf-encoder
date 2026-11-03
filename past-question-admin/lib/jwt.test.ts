import assert from "node:assert/strict";
import { test } from "node:test";
import { accessTokenNeedsRefresh, tokenExpirySeconds } from "./jwt.ts";

function jwtWith(payload: Record<string, unknown>): string {
  const b64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`;
}

const NOW = 1_800_000_000;

test("tokenExpirySeconds reads the exp claim from a base64url payload", () => {
  assert.equal(tokenExpirySeconds(jwtWith({ sub: "u1", exp: NOW + 60 })), NOW + 60);
});

test("tokenExpirySeconds returns null for malformed or claim-less tokens", () => {
  assert.equal(tokenExpirySeconds("not-a-jwt"), null);
  assert.equal(tokenExpirySeconds(""), null);
  assert.equal(tokenExpirySeconds(jwtWith({ sub: "u1" })), null);
  assert.equal(tokenExpirySeconds(jwtWith({ exp: "soon" })), null);
});

test("a token past its exp needs refresh; a live token does not", () => {
  assert.equal(accessTokenNeedsRefresh(jwtWith({ exp: NOW - 1 }), NOW), true);
  assert.equal(accessTokenNeedsRefresh(jwtWith({ exp: NOW }), NOW), true, "exp is inclusive");
  assert.equal(accessTokenNeedsRefresh(jwtWith({ exp: NOW + 1 }), NOW), false);
});

test("an unreadable token is not treated as expired locally; the backend decides with 401", () => {
  assert.equal(accessTokenNeedsRefresh("garbage", NOW), false);
});

test("the expiry check never trusts other claims such as role", () => {
  assert.equal(accessTokenNeedsRefresh(jwtWith({ exp: NOW + 100, role: "SUPER_ADMIN" }), NOW), false);
});
