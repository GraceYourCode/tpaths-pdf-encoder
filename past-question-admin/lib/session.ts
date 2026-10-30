import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "./api/auth";
import { ApiError } from "./api/errors";
import { getServerEnv } from "./env";
import type { AdminUser } from "./api/types";

const ADMIN_COOKIE_SUFFIX = "_admin";
interface CookieWriteOptions { httpOnly: true; secure: boolean; sameSite: "lax"; path: "/"; maxAge: number; }
function baseCookieOptions(maxAge: number): CookieWriteOptions { return { httpOnly: true, secure: getServerEnv().cookieSecure, sameSite: "lax", path: "/", maxAge }; }

export interface EstablishSessionArgs { accessToken: string; refreshToken?: string | null; admin?: AdminUser | null; maxAgeSeconds?: number; }

export async function establishSession(args: EstablishSessionArgs): Promise<void> {
  const env = getServerEnv(); const store = await cookies(); const maxAge = args.maxAgeSeconds ?? env.sessionMaxAgeSeconds;
  store.set(env.sessionCookieName, args.accessToken, baseCookieOptions(maxAge));
  if (args.refreshToken) store.set(env.refreshCookieName, args.refreshToken, baseCookieOptions(Math.max(maxAge, env.sessionMaxAgeSeconds)));
  if (args.admin) store.set(`${env.sessionCookieName}${ADMIN_COOKIE_SUFFIX}`, encodeAdmin(args.admin), baseCookieOptions(maxAge));
}

export async function clearSession(): Promise<void> {
  const env = getServerEnv(); const store = await cookies();
  for (const name of [env.sessionCookieName, env.refreshCookieName, `${env.sessionCookieName}${ADMIN_COOKIE_SUFFIX}`]) store.delete(name);
}

export async function getAccessToken(): Promise<string | null> { const store = await cookies(); return store.get(getServerEnv().sessionCookieName)?.value ?? null; }
export async function getRefreshToken(): Promise<string | null> { const store = await cookies(); return store.get(getServerEnv().refreshCookieName)?.value ?? null; }

export async function getSessionAdmin(): Promise<AdminUser | null> {
  const store = await cookies(); const raw = store.get(`${getServerEnv().sessionCookieName}${ADMIN_COOKIE_SUFFIX}`)?.value; return raw ? decodeAdmin(raw) : null;
}

export async function requireSession(): Promise<{ token: string; admin: AdminUser }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    const admin = await getCurrentAdmin(token);
    return { token, admin };
  } catch (error) {
    if (error instanceof ApiError && (error.kind === "unauthorized" || error.kind === "forbidden")) {
      redirect("/login");
    }
    throw error;
  }
}

function encodeAdmin(admin: AdminUser): string { return Buffer.from(JSON.stringify(admin), "utf8").toString("base64url"); }
function decodeAdmin(raw: string): AdminUser | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<AdminUser>;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.email !== "string" || (parsed.role !== "admin" && parsed.role !== "superadmin")) return null;
    return { id: parsed.id, email: parsed.email, name: parsed.name ?? null, role: parsed.role };
  } catch { return null; }
}
