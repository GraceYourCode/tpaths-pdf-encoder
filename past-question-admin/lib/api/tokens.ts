import type { AccessToken, BackendToken, ListQuery } from "./types";
import { backendRequest } from "./server";
import {
  filterAndPaginateTokens,
  mapToken,
  maskTokenId,
  TOKEN_FETCH_CAP,
  type TokenList,
} from "./token-model";

export { mapToken, TOKEN_FETCH_CAP, type TokenList };

export async function listTokens(query: ListQuery = {}): Promise<TokenList> {
  const raw = await backendRequest<BackendToken[]>({
    path: "/admin/tokens",
    method: "GET",
    query: { limit: TOKEN_FETCH_CAP },
  });
  const all = raw.map(mapToken);
  return {
    ...filterAndPaginateTokens(all, {
      status: query.status,
      productId: query.productId,
      page: query.page,
      pageSize: query.pageSize,
    }),
    capped: raw.length >= TOKEN_FETCH_CAP,
  };
}

/**
 * Creates ONE token. The plaintext code is returned only once, in this response,
 * and must never be persisted by the frontend.
 */
export async function generateToken(input: {
  productId: string;
  expiresAt?: string | null;
}): Promise<{ token: AccessToken; plaintextCode: string }> {
  const result = await backendRequest<{ id: string; token: string; expiresAt?: string | null }>({
    path: "/admin/tokens",
    method: "POST",
    body: {
      productId: input.productId,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    },
  });
  return {
    token: {
      id: result.id,
      maskedCode: maskTokenId(result.id),
      productId: input.productId,
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: result.expiresAt ?? null,
    },
    plaintextCode: result.token,
  };
}

export async function revokeToken(id: string): Promise<AccessToken> {
  const data = await backendRequest<BackendToken>({
    path: `/admin/tokens/${encodeURIComponent(id)}/revoke`,
    method: "POST",
  });
  return mapToken(data);
}
