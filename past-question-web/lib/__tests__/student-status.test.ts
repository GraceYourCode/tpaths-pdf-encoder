import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activationLabel,
  describeLicense,
  paymentStatusLabel,
  purchaseStatusLabel,
} from "../student-status.ts";

const now = new Date("2026-11-03T12:00:00Z");
const base = { status: "ACTIVE", expiresAt: null, deviceId: null, product: { status: "ACTIVE" } };

test("an active, unexpired licence on an active product is usable", () => {
  const v = describeLicense(base, now);
  assert.equal(v.label, "Active");
  assert.equal(v.usable, true);
});

test("a licence past its expiry date is not usable even if still ACTIVE", () => {
  const v = describeLicense({ ...base, expiresAt: "2026-01-01T00:00:00Z" }, now);
  assert.equal(v.label, "Expired");
  assert.equal(v.usable, false);
});

test("an EXPIRED status is expired even without a date", () => {
  assert.equal(describeLicense({ ...base, status: "EXPIRED" }, now).usable, false);
});

test("suspended and revoked licences are not usable", () => {
  assert.equal(describeLicense({ ...base, status: "SUSPENDED" }, now).label, "Suspended");
  assert.equal(describeLicense({ ...base, status: "REVOKED" }, now).label, "Revoked");
});

test("a licence whose product was archived is not usable", () => {
  const v = describeLicense({ ...base, product: { status: "ARCHIVED" } }, now);
  assert.equal(v.usable, false);
  assert.equal(v.label, "Product unavailable");
});

test("a licence expiring later today is still usable", () => {
  const v = describeLicense({ ...base, expiresAt: "2026-11-03T18:00:00Z" }, now);
  assert.equal(v.usable, true);
});

test("activation label reflects device binding", () => {
  assert.equal(activationLabel({ ...base, deviceId: null }), "Not yet activated on a device");
  assert.equal(activationLabel({ ...base, deviceId: "dev-1" }), "Bound to a device");
});

test("purchase and payment statuses map to readable labels", () => {
  assert.equal(purchaseStatusLabel("PAID"), "Paid");
  assert.equal(purchaseStatusLabel("PENDING"), "Pending");
  assert.equal(purchaseStatusLabel("WEIRD"), "WEIRD");
  assert.equal(paymentStatusLabel("SUCCESS"), "Successful");
});
