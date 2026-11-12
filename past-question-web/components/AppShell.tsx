'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from './SessionProvider';
import Brand from './Brand';

const links = [
  ['/dashboard', 'Overview'],
  ['/dashboard/purchases', 'Purchases'],
  ['/dashboard/library', 'Library'],
  ['/dashboard/licenses', 'Licenses'],
  ['/dashboard/activation', 'Activation'],
  ['/dashboard/transactions', 'Transactions'],
  ['/dashboard/profile', 'Profile'],
  ['/dashboard/security', 'Security'],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      router.replace('/auth/login');
    }
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/store" className="hidden text-slate-600 hover:text-slate-950 sm:inline">Store</Link>
            <span className="hidden text-slate-400 sm:inline">{user?.firstName} {user?.lastName}</span>
            <button className="button-secondary" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out…' : 'Log out'}</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-slate-200 bg-white px-2 py-2 text-xs lg:hidden" aria-label="Account">
          {links.map(([href, label]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-md px-3 py-2 ${pathname === href ? 'font-bold text-slate-950' : 'text-slate-600'}`}>{label}</Link>)}
        </nav>
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            {links.map(([href, label]) => <Link key={href} href={href} className={`nav-link ${pathname === href ? 'nav-link-active' : ''}`}>{label}</Link>)}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
    </div>
  );
}
