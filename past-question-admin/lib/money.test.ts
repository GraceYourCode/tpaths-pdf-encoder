import assert from "node:assert/strict";
import { test } from "node:test";
import { koboToNairaInput, MAX_KOBO, parseNairaToKobo } from "./money.ts";

test("parseNairaToKobo converts operator input to integer kobo", () => {
  assert.deepEqual(parseNairaToKobo("2500"), { ok: true, kobo: 250000 });
  assert.deepEqual(parseNairaToKobo("2,500.50"), { ok: true, kobo: 250050 });
  assert.deepEqual(parseNairaToKobo("₦ 10.5"), { ok: true, kobo: 1050 });
  assert.deepEqual(parseNairaToKobo("0.01"), { ok: true, kobo: 1 });
  assert.deepEqual(parseNairaToKobo("  300  "), { ok: true, kobo: 30000 });
});

test("parseNairaToKobo rejects empty, zero, negative and malformed amounts", () => {
  assert.equal(parseNairaToKobo("").ok, false);
  assert.equal(parseNairaToKobo("0").ok, false);
  assert.equal(parseNairaToKobo("0.00").ok, false);
  assert.equal(parseNairaToKobo("-100").ok, false);
  assert.equal(parseNairaToKobo("abc").ok, false);
  assert.equal(parseNairaToKobo("12.345").ok, false, "more than two decimals");
  assert.equal(parseNairaToKobo("1e3").ok, false);
});

test("parseNairaToKobo rejects amounts the backend Int column cannot store", () => {
  assert.equal(parseNairaToKobo(String(MAX_KOBO / 100 + 1)).ok, false);
  const max = parseNairaToKobo(String(Math.floor(MAX_KOBO / 100)));
  assert.equal(max.ok, true);
  assert.equal(parseNairaToKobo("999999999999999999999").ok, false);
});

test("koboToNairaInput renders editable naira and blanks unset prices", () => {
  assert.equal(koboToNairaInput(250000), "2500.00");
  assert.equal(koboToNairaInput(1), "0.01");
  assert.equal(koboToNairaInput(1050), "10.50");
  assert.equal(koboToNairaInput(0), "");
  assert.equal(koboToNairaInput(null), "");
  assert.equal(koboToNairaInput(undefined), "");
});

test("naira → kobo → naira round-trips for valid prices", () => {
  for (const amount of ["1", "9.99", "2500", "120000.5"]) {
    const parsed = parseNairaToKobo(amount);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(Number(koboToNairaInput(parsed.kobo)), Number(amount));
  }
});
