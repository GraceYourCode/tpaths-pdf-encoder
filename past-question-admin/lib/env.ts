/**
 * Server-side environment access for the admin app.
 *
 * These values come from the Node process environment and are intended for
 * SERVER use only (Server Components, Server Actions, Route Handlers). None of
 * them (except the explicitly public `APP_NAME`) are prefixed `NEXT_PUBLIC_`,
 * so Next.js never bundles them into client-side JavaScript.
 *
 * We read lazily (inside functions) rather than at module load so that missing
 * configuration produces a clear runtime error at the point of use, and never
 * breaks a build or a client bundle.
 */

export interface ServerEnv {
  /** Backend API base URL including version prefix, e.g. http://localhost:3000/api/v1 (no trailing slash). */
  apiBaseUrl: string;
  /** httpOnly cookie name holding the backend-issued admin access token. */
  sessionCookieName: string;
  /** httpOnly cookie name holding the backend-issued refresh token (if any). */
  refreshCookieName: string;
  /** Whether the `Secure` flag is set on session cookies. */
  cookieSecure: boolean;
  /** Fallback session lifetime (seconds) when the backend gives no explicit expiry. */
  sessionMaxAgeSeconds: number;
  isProduction: boolean;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function parseIntOr(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getServerEnv(): ServerEnv {
  const isProduction = process.env.NODE_ENV === "production";
  const rawBase = process.env.API_BASE_URL ?? "http://localhost:3000/api/v1";
  return {
    apiBaseUrl: rawBase.replace(/\/+$/, ""),
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "tpaths_admin_session",
    refreshCookieName:
      process.env.SESSION_REFRESH_COOKIE_NAME ?? "tpaths_admin_refresh",
    cookieSecure: parseBool(process.env.SESSION_COOKIE_SECURE, isProduction),
    sessionMaxAgeSeconds: parseIntOr(
      process.env.SESSION_MAX_AGE_SECONDS,
      8 * 60 * 60,
    ),
    isProduction,
  };
}

/** Browser-safe application name (the only intentionally-public env value). */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "TPaths Admin";
