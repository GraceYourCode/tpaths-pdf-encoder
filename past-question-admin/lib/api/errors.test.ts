import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, describeError, kindForStatus } from "./errors.ts";

test("kindForStatus maps HTTP statuses to error kinds", () => {
  assert.equal(kindForStatus(400), "validation");
  assert.equal(kindForStatus(422), "validation");
  assert.equal(kindForStatus(401), "unauthorized");
  assert.equal(kindForStatus(403), "forbidden");
  assert.equal(kindForStatus(404), "not_found");
  assert.equal(kindForStatus(409), "conflict");
  assert.equal(kindForStatus(429), "rate_limited");
  assert.equal(kindForStatus(501), "not_implemented");
  assert.equal(kindForStatus(500), "server");
  assert.equal(kindForStatus(503), "server");
  assert.equal(kindForStatus(418), "http");
});

test("ApiError.fromResponse uses backend message or a sensible default", () => {
  const withMsg = ApiError.fromResponse(404, { message: "No such product" });
  assert.equal(withMsg.kind, "not_found");
  assert.equal(withMsg.status, 404);
  assert.equal(withMsg.message, "No such product");

  const withoutMsg = ApiError.fromResponse(500);
  assert.equal(withoutMsg.kind, "server");
  assert.match(withoutMsg.message, /backend/i);
});

test("isAuthError is true only for unauthorized", () => {
  assert.equal(new ApiError({ kind: "unauthorized", message: "x" }).isAuthError, true);
  assert.equal(new ApiError({ kind: "forbidden", message: "x" }).isAuthError, false);
});

test("describeError produces safe, honest descriptions", () => {
  const network = describeError(new ApiError({ kind: "network", message: "down" }));
  assert.deepEqual(network, {
    title: "Cannot reach the backend",
    message: "down",
    kind: "network",
  });

  const notImpl = describeError(
    new ApiError({ kind: "not_implemented", message: "not built" }),
  );
  assert.equal(notImpl.title, "Backend endpoint not available");

  const generic = describeError(new Error("boom"));
  assert.equal(generic.kind, "unknown");
  assert.equal(generic.message, "An unexpected error occurred. Please try again.");

  const nonError = describeError("just a string");
  assert.equal(nonError.kind, "unknown");
  assert.equal(nonError.message, "An unexpected error occurred. Please try again.");
});
