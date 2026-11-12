import { NextRequest } from 'next/server';
import { backendFetch, clearSessionCookies, clientForwardHeaders, jsonResponse } from '@/lib/server/session';

/**
 * Ends the session. Revokes the backend session on a best-effort basis, then
 * always clears the cookies so the browser is signed out locally even if the
 * backend is unreachable.
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    try {
      await backendFetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: authorization, ...clientForwardHeaders(request) },
      });
    } catch {
      // Ignored on purpose: local cookies are cleared below regardless.
    }
  }
  const response = jsonResponse({ loggedOut: true });
  clearSessionCookies(response);
  return response;
}
