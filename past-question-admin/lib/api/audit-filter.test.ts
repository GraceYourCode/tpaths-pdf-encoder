import assert from "node:assert/strict";
import { test } from "node:test";
import { distinctAuditActions, filterAuditEvents } from "./audit-filter.ts";
import type { AuditEvent } from "./types.ts";

const ev = (id: string, over: Partial<AuditEvent>): AuditEvent => ({
  id, action: "ADMIN_ACTION", entityType: null, entityId: null, actorId: null,
  ipAddress: null, metadata: null, createdAt: "2026-01-01", ...over,
});

const events = [
  ev("1", { action: "DEVICE_REVOKED", entityType: "Device", entityId: "dev-abc" }),
  ev("2", { action: "ADMIN_ACTION", metadata: '{"operation":"update"}', actorId: "admin-9" }),
  ev("3", { action: "LICENSE_REVOKED", ipAddress: "10.0.0.7" }),
];

test("empty filter returns every event unchanged", () => {
  assert.equal(filterAuditEvents(events, {}).length, 3);
});

test("action filter matches the exact action only", () => {
  assert.deepEqual(filterAuditEvents(events, { action: "ADMIN_ACTION" }).map((e) => e.id), ["2"]);
});

test("free-text search is case-insensitive across entity, actor, IP and metadata", () => {
  assert.deepEqual(filterAuditEvents(events, { q: "DEV-ABC" }).map((e) => e.id), ["1"]);
  assert.deepEqual(filterAuditEvents(events, { q: "admin-9" }).map((e) => e.id), ["2"]);
  assert.deepEqual(filterAuditEvents(events, { q: "10.0.0" }).map((e) => e.id), ["3"]);
  assert.deepEqual(filterAuditEvents(events, { q: "operation" }).map((e) => e.id), ["2"]);
});

test("whitespace-only search is treated as no search", () => {
  assert.equal(filterAuditEvents(events, { q: "   " }).length, 3);
});

test("search and action combine with AND", () => {
  assert.equal(filterAuditEvents(events, { q: "dev", action: "LICENSE_REVOKED" }).length, 0);
});

test("distinct actions are unique and sorted", () => {
  assert.deepEqual(distinctAuditActions(events), ["ADMIN_ACTION", "DEVICE_REVOKED", "LICENSE_REVOKED"]);
});
