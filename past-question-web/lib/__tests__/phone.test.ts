import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidWhatsapp, normalizeWhatsapp } from "../phone.ts";

test("normalizeWhatsapp strips spacing and punctuation", () => {
  assert.equal(normalizeWhatsapp("+234 801 234 5678"), "+2348012345678");
  assert.equal(normalizeWhatsapp("(+234) 801-234-5678"), "+2348012345678");
});

test("isValidWhatsapp matches the backend rule", () => {
  assert.equal(isValidWhatsapp("+2348012345678"), true);
  assert.equal(isValidWhatsapp("08012345678"), false); // local format without country code is rejected
  assert.equal(isValidWhatsapp("+0801234567"), false);
  assert.equal(isValidWhatsapp("+123"), false);
  assert.equal(isValidWhatsapp("abc"), false);
});
