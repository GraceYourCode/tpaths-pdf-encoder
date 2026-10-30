"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { AdminUser } from "@/lib/api/types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Authenticated app chrome. Holds the mobile-drawer open state shared between
 * the Topbar trigger and the Sidebar. `children` are server-rendered pages
 * passed through by the (server) dashboard layout — the client boundary stops
 * here, so page data-fetching stays on the server.
 */
export function AdminShell({
  appName,
  admin,
  children,
}: {
  appName: string;
  admin: AdminUser | null;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        appName={appName}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar admin={admin} onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
