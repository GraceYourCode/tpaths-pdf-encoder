'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from './SessionProvider';

/**
 * Client-side guard for protected screens. It is a UX layer only: the proxy
 * redirects signed-out visitors first, and the backend rejects any data request
 * without a valid token. Users are sent back to the page they wanted after login.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) return <div className="page-center"><div className="spinner" /></div>;
  return <>{children}</>;
}
