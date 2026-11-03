import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, describeError, kindForStatus } from "./errors.ts";

test("413 (file too large) is a validation error with an upload-specific message", () => {
  assert.equal(kindForStatus(413), "validation");
  const err = ApiError.fromResponse(413, undefined);
  assert.equal(err.kind, "validation");
  assert.equal(err.message, "The file is too large. The maximum upload size is 25 MB.");
});

test("415 (unsupported media type) explains that a PDF is required", () => {
  const err = ApiError.fromResponse(415, undefined);
  assert.equal(err.kind, "validation");
  assert.equal(err.message, "That file type is not supported. Upload a PDF.");
});

test("a backend validation message is shown in preference to the generic copy", () => {
  const err = ApiError.fromResponse(400, { code: "BAD_REQUEST", message: "Only PDF files are allowed" });
  assert.equal(err.message, "Only PDF files are allowed");
  assert.equal(describeError(err).title, "Invalid request");
});

test("unexpected non-Error values never leak details", () => {
  const described = describeError({ stack: "secret", token: "abc" });
  assert.equal(described.kind, "unknown");
  assert.equal(described.message.includes("secret"), false);
});

test("401 and 403 map to the session and permission states the UI reacts to", () => {
  assert.equal(describeError(ApiError.fromResponse(401, undefined)).title, "Session expired");
  assert.equal(describeError(ApiError.fromResponse(403, undefined)).title, "Not authorized");
  assert.equal(ApiError.fromResponse(401, undefined).isAuthError, true);
});

test("5xx and 501 responses get honest, distinct titles", () => {
  assert.equal(describeError(ApiError.fromResponse(500, undefined)).title, "Backend error");
  assert.equal(describeError(ApiError.fromResponse(501, undefined)).title, "Backend endpoint not available");
});
