/**
 * Pure access-token model: mapping and in-memory filtering/paging.
 *
 * Split from `tokens.ts` (which imports `next/headers` through `server.ts`) so
 * the logic can be unit-tested under `node --test`.
 */

import type { AccessToken, BackendToken, Paginated, TokenStatus } from "./types.ts";

/** Largest page the backend's `GET /admin/tokens` returns (`take = min(100, limit)`). */
export const TOKEN_FETCH_CAP = 100;

/**
 * The backend token list has no `page`, `status` or `productId` support. Paging
 * and filtering happen in the UI layer, and `capped` says when older tokens
 * exist beyond the fetched window.
 */
export interface TokenList extends Paginated<AccessToken> {
  capped: boolean;
}

function statusOf(status: BackendToken["status"]): TokenStatus {
  if (status === "UNUSED" || status === "ACTIVE") return "active";
  return status.toLowerCase() as TokenStatus;
}

/** Non-secret display mask derived from the row id. The plaintext code is never stored. */
export function maskTokenId(id: string): string {
  return `Token •••• ${id.slice(-6).toUpperCase()}`;
}

export function mapToken(token: BackendToken): AccessToken {
  return {
    id: token.id,
    maskedCode: maskTokenId(token.id),
    productId: token.productId,
    purchaseId: token.purchaseId ?? null,
    status: statusOf(token.status),
    createdAt: token.createdAt,
    expiresAt: token.expiresAt ?? null,
    redeemedAt: token.activatedAt ?? null,
  };
}

export function filterAndPaginateTokens(
  all: AccessToken[],
  query: { status?: string; productId?: string; page?: number; pageSize?: number },
): Paginated<AccessToken> {
  const pageSize = Math.max(1, query.pageSize ?? 20);
  const page = Math.max(1, query.page ?? 1);
  const filtered = all.filter(
    (t) =>
      (!query.status || t.status === query.status) &&
      (!query.productId || t.productId === query.productId),
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
