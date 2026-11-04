/**
 * Client-side search and filter for audit events.
 *
 * The backend's audit endpoint has no query filters, so filtering runs over the
 * rows already fetched. The UI states that scope. Pure: runs under `node --test`.
 */
import type { AuditEvent } from "./types.ts";

export interface AuditFilter {
  q?: string;
  action?: string;
}

export function filterAuditEvents(events: AuditEvent[], filter: AuditFilter): AuditEvent[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  return events.filter((e) => {
    if (filter.action && e.action !== filter.action) return false;
    if (!q) return true;
    return [e.action, e.entityType, e.entityId, e.actorId, e.ipAddress, e.metadata]
      .some((value) => (value ?? "").toLowerCase().includes(q));
  });
}

/** Distinct action names, sorted, for the filter dropdown. */
export function distinctAuditActions(events: AuditEvent[]): string[] {
  return [...new Set(events.map((e) => e.action))].sort((a, b) => a.localeCompare(b));
}
