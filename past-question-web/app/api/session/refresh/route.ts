import { NextRequest } from 'next/server';
import {
  REFRESH_COOKIE,
  backendFetch,
  clearSessionCookies,
  clientForwardHeaders,
  errorResponse,
  jsonResponse,
  passThroughHeaders,
  readBody,
  setSessionCookies,
} from '@/lib/server/session';

/**
 * Rotates the session. Reads the refresh token from the HTTP-only cookie, asks the
 * backend for a new pair, stores the new refresh token, and returns only the new
 * access token.
 *
 * Only a 401 from the backend means the session is over, and only then are the
 * cookies cleared. Rate limiting (429) and outages (5xx) are passed through without
 * touching the cookie, so a brief backend problem does not sign students out.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return errorResponse('No active session.', 401);

  let upstream: Response;
  try {
    upstream = await backendFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientForwardHeaders(request) },
      body: JSON.stringify({ token: refreshToken }),
    });
  } catch {
    return errorResponse('Unable to reach the server. Please try again.', 503);
  }

  const payload = await readBody(upstream);

  if (upstream.status === 401 || (upstream.ok && (!payload.accessToken || !payload.refreshToken))) {
    const failed = errorResponse('Your session has expired. Please log in again.', 401);
    clearSessionCookies(failed);
    return failed;
  }

  if (!upstream.ok) {
    // 429, 5xx: keep the session, tell the browser to back off.
    const text = upstream.status === 429 ? 'Too many requests. Please wait a moment.' : 'The server is temporarily unavailable.';
    return jsonResponse({ error: { message: text } }, upstream.status, passThroughHeaders(upstream));
  }

  const response = jsonResponse({ accessToken: payload.accessToken });
  setSessionCookies(response, payload.refreshToken);
  return response;
}
