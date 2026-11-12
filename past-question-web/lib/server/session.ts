import { NextResponse } from 'next/server';

/**
 * Server-only session helpers.
 *
 * The backend returns the refresh token in its JSON body. Browser JavaScript
 * must never see it, so it is kept in an HTTP-only cookie scoped to
 * /api/session, which only the session routes receive.
 *
 * A second cookie, SESSION_MARKER_COOKIE, holds the value "1" and no secret. It
 * exists only so the Next.js proxy can redirect signed-out visitors away from
 * protected pages (the refresh cookie's path does not cover page requests). The
 * backend remains the authority for every data request.
 */

export const REFRESH_COOKIE = 'tpaths_rt';
export const SESSION_MARKER_COOKIE = 'tpaths_session';
export const SESSION_PATH = '/api/session';
// Matches the backend's default 30-day refresh lifetime. The backend still enforces expiry.
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function backendBaseUrl(): string {
  const url = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!url) throw new Error('Backend URL is not configured.');
  return url;
}

/**
 * The backend rate-limits login, refresh and register per client IP, and uses
 * req.ip (which honours X-Forwarded-For only when TRUST_PROXY is set). Calls made
 * from this server would otherwise all share one IP, so the browser's address is
 * forwarded. The last X-Forwarded-For entry is the one appended by the edge proxy
 * in front of this app; earlier entries are client-supplied and are ignored.
 */
export function clientForwardHeaders(request: Request): Record<string, string> {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return {};
  const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
  const clientIp = parts[parts.length - 1];
  return clientIp ? { 'x-forwarded-for': clientIp } : {};
}

export function backendFetch(path: string, init: RequestInit = {}) {
  return fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
}

/** Keeps Retry-After from a rate-limited backend response so the browser can show a wait time. */
export function passThroughHeaders(upstream: Response): Record<string, string> {
  const retryAfter = upstream.headers.get('retry-after');
  return retryAfter ? { 'Retry-After': retryAfter, 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' };
}

export async function readBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return response.json().catch(() => ({}));
  return {};
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Mirrors the backend error envelope: { error: { code?, message, details? } }. */
export function errorResponse(message: string, status: number, code?: string) {
  return jsonResponse({ error: { ...(code ? { code } : {}), message } }, status);
}

const secure = () => process.env.NODE_ENV === 'production';

export function setSessionCookies(response: NextResponse, refreshToken: string) {
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: SESSION_PATH,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
  response.cookies.set(SESSION_MARKER_COOKIE, '1', {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: SESSION_PATH,
    maxAge: 0,
  });
  response.cookies.set(SESSION_MARKER_COOKIE, '', {
    httpOnly: true,
    secure: secure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
