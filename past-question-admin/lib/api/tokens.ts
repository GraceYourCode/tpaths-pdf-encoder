import type { AccessToken, BackendToken, ListQuery, Paginated, TokenGenerateInput, TokenGenerateResult, TokenStatus } from "./types";
import { backendRequest } from "./server";

function statusOf(status: BackendToken["status"]): TokenStatus {
  if (status === "UNUSED" || status === "ACTIVE") return "active";
  return status.toLowerCase() as TokenStatus;
}

function mask(id: string): string { return `Token •••• ${id.slice(-6).toUpperCase()}`; }
function mapToken(token: BackendToken): AccessToken {
  return { id: token.id, maskedCode: mask(token.id), productId: token.productId, purchaseId: token.purchaseId ?? null, status: statusOf(token.status), createdAt: token.createdAt, expiresAt: token.expiresAt ?? null, redeemedAt: token.activatedAt ?? null };
}

export async function listTokens(query: ListQuery = {}): Promise<Paginated<AccessToken>> {
  const raw = await backendRequest<BackendToken[]>({ path: "/admin/tokens", method: "GET", query: { page: query.page, limit: query.pageSize, status: query.status?.toUpperCase(), productId: query.productId } });
  let items = raw.map(mapToken);
  if (query.productId) items = items.filter((t) => t.productId === query.productId);
  if (query.status) items = items.filter((t) => t.status === query.status);
  const pageSize = query.pageSize ?? 20;
  const page = query.page ?? 1;
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function generateToken(input: Omit<TokenGenerateInput, "quantity" | "studentEmail">): Promise<{ token: AccessToken; plaintextCode: string }> {
  const result = await backendRequest<{ id: string; token: string; expiresAt?: string | null }>({ path: "/admin/tokens", method: "POST", body: { productId: input.productId, expiresAt: input.expiresAt || undefined } });
  return { token: { id: result.id, maskedCode: mask(result.id), productId: input.productId, status: "active", createdAt: new Date().toISOString(), expiresAt: result.expiresAt ?? null }, plaintextCode: result.token };
}

export async function revokeToken(id: string): Promise<AccessToken> {
  const data = await backendRequest<BackendToken>({ path: `/admin/tokens/${encodeURIComponent(id)}/revoke`, method: "POST" });
  return mapToken(data);
}

export { mapToken };
