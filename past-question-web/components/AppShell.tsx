'use client';

import Link from 'next/link';
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
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/store" className="hidden text-slate-600 hover:text-slate-950 sm:inline">Store</Link>
            <span className="hidden text-slate-400 sm:inline">{user?.firstName} {user?.lastName}</span>
            <button className="button-secondary" onClick={() => { void logout().then(() => router.push('/auth/login')); }}>Log out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            {links.map(([href, label]) => <Link key={href} href={href} className={`nav-link ${pathname === href ? 'nav-link-active' : ''}`}>{label}</Link>)}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
