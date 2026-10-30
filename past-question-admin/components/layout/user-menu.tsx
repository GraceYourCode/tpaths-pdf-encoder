"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import type { AdminUser } from "@/lib/api/types";
import { initialsFromName } from "@/lib/format";

/**
 * Admin identity + sign-out menu.
 *
 * Sign-out is a native `POST` to the `/logout` Route Handler, which clears the
 * httpOnly session cookies server-side and redirects to `/login`. Using a form
 * (not a client fetch) means logout works even without client JS and never
 * needs to touch the token from the browser.
 */
export function UserMenu({ admin }: { admin: AdminUser | null }) {
  const [open, setOpen] = useState(false);
  const primaryLabel = admin?.name || admin?.email || "Administrator";
  const showEmail = Boolean(admin?.email && admin.email !== primaryLabel);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initialsFromName(primaryLabel)}
        </span>
        <span className="hidden max-w-[12rem] truncate text-sm font-medium text-foreground sm:block">
          {primaryLabel}
        </span>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-md border border-border bg-card p-1 shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium text-foreground">
                {primaryLabel}
              </p>
              {showEmail ? (
                <p className="truncate text-xs text-muted-foreground">
                  {admin?.email}
                </p>
              ) : null}
              {admin?.role ? (
                <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                  {admin.role}
                </p>
              ) : null}
            </div>
            <div className="my-1 h-px bg-border" />
            <form action="/logout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
