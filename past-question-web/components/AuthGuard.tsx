'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from './SessionProvider';
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace('/auth/login'); }, [loading, user, router]);
  if (loading || !user) return <div className="page-center"><div className="spinner" /></div>;
  return <>{children}</>;
}
