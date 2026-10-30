import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login"];
const ADMIN_COOKIE_SUFFIX = "_admin";

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function tokenExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch { return null; }
}

async function refreshIfExpired(request: NextRequest, response: NextResponse): Promise<NextResponse | null> {
  const env = getServerEnv();
  const access = request.cookies.get(env.sessionCookieName)?.value;
  const refresh = request.cookies.get(env.refreshCookieName)?.value;
  if (!access || !refresh) return null;
  const exp = tokenExpiry(access);
  if (exp === null || exp > Math.floor(Date.now() / 1000)) return response;

  try {
    const backend = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: refresh }),
      cache: "no-store",
    });
    if (!backend.ok) return null;
    const parsed = await backend.json() as { success?: boolean; data?: { accessToken?: string; refreshToken?: string }; accessToken?: string; refreshToken?: string };
    const data = parsed.success === true ? parsed.data : parsed;
    if (!data?.accessToken) return null;

    const maxAge = env.sessionMaxAgeSeconds;
    response.cookies.set(env.sessionCookieName, data.accessToken, { httpOnly: true, secure: env.cookieSecure, sameSite: "lax", path: "/", maxAge });
    if (data.refreshToken) response.cookies.set(env.refreshCookieName, data.refreshToken, { httpOnly: true, secure: env.cookieSecure, sameSite: "lax", path: "/", maxAge });
    response.cookies.delete(`${env.sessionCookieName}${ADMIN_COOKIE_SUFFIX}`);
    return response;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const env = getServerEnv();
  const hasSession = Boolean(request.cookies.get(env.sessionCookieName)?.value);

  if (isPublicPath(pathname)) {
    if (hasSession) {
      const url = request.nextUrl.clone(); url.pathname = "/"; url.search = ""; return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""; return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  const refreshed = await refreshIfExpired(request, response);
  if (refreshed) return refreshed;

  const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = "";
  const redirectResponse = NextResponse.redirect(url);
  for (const name of [env.sessionCookieName, env.refreshCookieName, `${env.sessionCookieName}${ADMIN_COOKIE_SUFFIX}`]) redirectResponse.cookies.delete(name);
  return redirectResponse;
}

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
