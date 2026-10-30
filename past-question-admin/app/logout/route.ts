import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getAccessToken } from "@/lib/session";
import { logoutBackend } from "@/lib/api/auth";

/**
 * Sign-out endpoint (Route Handler).
 *
 * POST-only, invoked by the user-menu form. It makes a best-effort call to the
 * backend to invalidate the token server-side, then always clears the local
 * httpOnly session cookies on the redirect response and sends the user to
 * `/login`. Clearing cookies here (not in a Server Component) is required —
 * cookies are only writable in Route Handlers and Server Actions.
 */
export async function POST(request: Request) {
  const env = getServerEnv();

  try {
    const token = await getAccessToken();
    if (token) await logoutBackend(token);
  } catch {
    // Best-effort only: if the backend logout endpoint is missing or errors,
    // we still clear the local session below.
  }

  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });

  // Expire every session cookie set by `establishSession` (see lib/session.ts).
  for (const name of [
    env.sessionCookieName,
    env.refreshCookieName,
    `${env.sessionCookieName}_admin`,
  ]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return response;
}
