import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection for student pages. Signed-out visitors are redirected to
 * login before any protected HTML is rendered. The check reads only the
 * presence of the non-secret session marker cookie. It is not a security
 * boundary on its own; every data request is still authorized by the backend.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/checkout'];
const SESSION_MARKER_COOKIE = 'tpaths_session';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const protectedPath = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!protectedPath) return NextResponse.next();
  if (request.cookies.get(SESSION_MARKER_COOKIE)?.value) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/auth/login';
  url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
