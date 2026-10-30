"use client";

import { Menu } from "lucide-react";
import type { AdminUser } from "@/lib/api/types";
import { UserMenu } from "./user-menu";

/** Sticky top bar: mobile menu trigger + admin user menu. */
export function Topbar({
  admin,
  onMenuClick,
}: {
  admin: AdminUser | null;
  onMenuClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <UserMenu admin={admin} />
    </header>
  );
}
