import {
  backendFetch,
  clientForwardHeaders,
  errorResponse,
  jsonResponse,
  passThroughHeaders,
  readBody,
  setSessionCookies,
} from '@/lib/server/session';

/**
 * Relays login to the backend. The refresh token is stored in an HTTP-only
 * cookie and removed from the response, so browser JavaScript only receives the
 * short-lived access token and the user. Backend error objects (including
 * `code`) are forwarded unchanged so the client can branch on them.
 */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid request.', 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return errorResponse('Email and password are required.', 400);

  let upstream: Response;
  try {
    upstream = await backendFetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...clientForwardHeaders(request) },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return errorResponse('Unable to reach the server. Please try again.', 502);
  }

  const payload = await readBody(upstream);
  if (!upstream.ok) {
    return jsonResponse(
      { error: payload?.error ?? { message: payload?.message ?? 'Unable to log in.' } },
      upstream.status,
      passThroughHeaders(upstream),
    );
  }
  if (!payload.accessToken || !payload.refreshToken) {
    return errorResponse('The server did not return a session.', 502);
  }

  const response = jsonResponse({ accessToken: payload.accessToken, user: payload.user });
  setSessionCookies(response, payload.refreshToken);
  return response;
}
