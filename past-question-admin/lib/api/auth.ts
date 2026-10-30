import { ApiError } from "./errors";
import { backendRequest } from "./server";
import { toAdminUser, type AdminUser, type BackendUser } from "./types";

export interface LoginCredentials { email: string; password: string; }
export interface LoginResult {
  accessToken: string;
  refreshToken?: string | null;
  admin?: AdminUser | null;
  expiresIn?: number | null;
}

interface BackendLoginResult {
  accessToken: string;
  refreshToken?: string | null;
  user: BackendUser;
}

function mapLogin(result: BackendLoginResult): LoginResult {
  try {
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? null,
      admin: toAdminUser(result.user),
    };
  } catch {
    throw new ApiError({ kind: "forbidden", status: 403, message: "This account is not authorized to use the admin console." });
  }
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const result = await backendRequest<BackendLoginResult>({ path: "/auth/login", method: "POST", body: credentials, authenticated: false });
  return mapLogin(result);
}

export async function getCurrentAdmin(token?: string): Promise<AdminUser> {
  const user = await backendRequest<BackendUser>({ path: "/auth/me", method: "GET", token });
  try { return toAdminUser(user); }
  catch { throw new ApiError({ kind: "forbidden", status: 403, message: "This account is not authorized to use the admin console." }); }
}

export async function logoutBackend(token?: string): Promise<void> {
  await backendRequest<unknown>({ path: "/auth/logout", method: "POST", token });
}

export async function refreshTokens(refreshToken: string): Promise<LoginResult> {
  const result = await backendRequest<{ accessToken: string; refreshToken?: string | null }>({
    path: "/auth/refresh", method: "POST", body: { token: refreshToken }, authenticated: false,
  });
  return { accessToken: result.accessToken, refreshToken: result.refreshToken ?? null };
}
