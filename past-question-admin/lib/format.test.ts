import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNaira,
  formatRelativeTime,
  initialsFromName,
  truncate,
} from "./format.ts";

test("formatDate renders a valid date and dashes for empties", () => {
  // Construct in local time to avoid UTC-midnight rollover across timezones.
  assert.match(formatDate(new Date(2026, 0, 12)), /12 Jan 2026/);
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("not-a-date"), "—");
});

test("formatDateTime includes date and 24h time", () => {
  const out = formatDateTime(new Date(2026, 0, 12, 14, 3));
  assert.match(out, /12 Jan 2026/);
  assert.match(out, /14:03/);
  assert.equal(formatDateTime(undefined), "—");
});

test("formatRelativeTime buckets by elapsed time (now injected)", () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeTime(now - 10 * 1000, now), "just now");
  assert.equal(formatRelativeTime(now - 120 * 1000, now), "2 min ago");
  assert.equal(formatRelativeTime(now - 2 * 3600 * 1000, now), "2 h ago");
  assert.equal(formatRelativeTime(now - 3 * 86400 * 1000, now), "3 d ago");
  // Far in the future falls back to an absolute date, not "just now".
  assert.notEqual(formatRelativeTime(now + 5000, now), "just now");
  assert.equal(formatRelativeTime(null, now), "—");
});

test("formatNaira handles kobo and major units", () => {
  assert.match(formatNaira(1000, { fromKobo: true }), /10\.00/);
  assert.match(formatNaira(250000, { fromKobo: true }), /2,500\.00/);
  assert.match(formatNaira(2500), /2,500\.00/);
  assert.equal(formatNaira(null), "—");
  assert.equal(formatNaira(Number.NaN), "—");
});

test("formatFileSize scales units", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(formatFileSize(1024 * 1024), "1.0 MB");
  assert.equal(formatFileSize(null), "—");
});

test("truncate adds an ellipsis only when needed", () => {
  assert.equal(truncate("hello world", 5), "hell…");
  assert.equal(truncate("hi", 5), "hi");
  assert.equal(truncate("abc", 0), "");
});

test("initialsFromName derives up to two initials", () => {
  assert.equal(initialsFromName("Ada Lovelace"), "AL");
  assert.equal(initialsFromName("ada"), "A");
  assert.equal(initialsFromName("ada@example.com"), "A");
  assert.equal(initialsFromName("mary-jane watson"), "MW");
  assert.equal(initialsFromName(null), "?");
});
