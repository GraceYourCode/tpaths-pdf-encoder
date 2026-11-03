import type {
  AuditEvent,
  BackendAuditLog,
  BackendLicense,
  BackendPurchase,
  LicenseRecord,
  Paginated,
  PurchaseRecord,
} from "./types";
import { mapAuditEvent, mapLicense, mapPurchase } from "./types";
import { backendRequest } from "./server";

/* ---------------------------------------------------------------------------
 * Purchases and payments
 *
 * `GET /admin/purchases` returns a bare array (no envelope, no total). Each row
 * carries the payment record it was paid through, so the Payments screen is a
 * ledger view over the same endpoint. A dedicated admin payments endpoint does
 * not exist on the backend.
 * ------------------------------------------------------------------------- */

export interface PurchasePage {
  items: PurchaseRecord[];
  page: number;
  pageSize: number;
  /** The backend returns no total; a full page means another page may exist. */
  hasNext: boolean;
}

export async function listPurchases(query: { page?: number; pageSize?: number } = {}): Promise<PurchasePage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const rows = await backendRequest<BackendPurchase[]>({
    path: "/admin/purchases",
    method: "GET",
    query: { page, limit: pageSize },
  });
  return {
    items: rows.map(mapPurchase),
    page,
    pageSize,
    hasNext: rows.length >= pageSize,
  };
}

/* ---------------------------------------------------------------------------
 * Licenses
 * ------------------------------------------------------------------------- */

export interface LicenseList extends Paginated<LicenseRecord> {
  /**
   * The backend's `GET /admin/licenses` currently ignores query parameters and
   * always returns the newest page. `honoured` is false when the response does
   * not match what was requested, so the UI can say so.
   */
  honoured: boolean;
}

export async function listLicenses(query: { page?: number; pageSize?: number; status?: string } = {}): Promise<LicenseList> {
  const requestedPage = Math.max(1, query.page ?? 1);
  const data = await backendRequest<{ items: BackendLicense[]; total: number; page: number; limit: number; totalPages: number }>({
    path: "/admin/licenses",
    method: "GET",
    query: { page: requestedPage, limit: query.pageSize, status: query.status?.toUpperCase() },
  });
  const items = data.items.map(mapLicense);
  const honoured =
    data.page === requestedPage &&
    (!query.status || items.every((l) => l.status === query.status));
  return {
    items,
    total: data.total,
    page: data.page,
    pageSize: data.limit,
    totalPages: data.totalPages,
    honoured,
  };
}

export async function getLicense(id: string): Promise<LicenseRecord> {
  const data = await backendRequest<BackendLicense>({
    path: `/admin/licenses/${encodeURIComponent(id)}`,
    method: "GET",
  });
  return mapLicense(data);
}

export async function setLicenseStatus(id: string, action: "suspend" | "revoke"): Promise<void> {
  await backendRequest<unknown>({
    path: `/admin/licenses/${encodeURIComponent(id)}/${action}`,
    method: "POST",
  });
}

/* ---------------------------------------------------------------------------
 * Audit log
 * ------------------------------------------------------------------------- */

export const AUDIT_MAX_LIMIT = 100;

export async function listAuditEvents(limit = 50): Promise<AuditEvent[]> {
  const rows = await backendRequest<BackendAuditLog[]>({
    path: "/admin/audit-logs",
    method: "GET",
    query: { limit: Math.min(AUDIT_MAX_LIMIT, Math.max(1, limit)) },
  });
  return rows.map(mapAuditEvent);
}
