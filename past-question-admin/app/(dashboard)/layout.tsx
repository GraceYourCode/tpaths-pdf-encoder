import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { APP_NAME } from "@/lib/env";
import { requireSession } from "@/lib/session";

/**
 * Authenticated dashboard layout (Server Component).
 *
 * `requireSession()` is the server-side gate: if the httpOnly session cookie is
 * absent it redirects to `/login` before any dashboard page renders. This — not
 * the optimistic `proxy.ts` check — is what actually keeps unauthenticated users
 * out. The backend still re-validates the token on every API call and remains
 * the ultimate authorization boundary.
 *
 * Plain `{ children }` typing (rather than `LayoutProps<...>`) is deliberate: the
 * `(dashboard)` route group is stripped from the generated route map, so several
 * group layouts can resolve to the same "/" key. A plain prop type stays
 * unambiguous and is structurally assignable to what Next expects.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { admin } = await requireSession();

  return (
    <AdminShell appName={APP_NAME} admin={admin}>
      {children}
    </AdminShell>
  );
}
