"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Brand } from "./brand";
import { isNavItemActive, NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";
import Image from "next/image";

/**
 * App sidebar. Fixed on large screens; a slide-in drawer on mobile controlled
 * by `open`/`onClose` (state lives in the parent `AdminShell`).
 */
export function Sidebar({
  appName,
  open,
  onClose,
}: {
  appName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-5">
          <Link
            href="/"
            onClick={onClose}
            aria-label={`${appName} — home`}
            className="flex items-center gap-2"
          >
            <Image
              src="/tpaths-logo.svg"
              alt={`${appName} logo`}
              width={32}
              height={32}
              className="fill-white"
            />
            <span className="logo">TPaths</span>
            <span className="text-sm font-medium text-sidebar-muted">Admin</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1 text-sidebar-muted hover:text-sidebar-active-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-active text-sidebar-active-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-active-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-accent px-5 py-4 text-xs text-sidebar-muted">
          Restricted access · authorized administrators only
        </div>
      </aside>
    </>
  );
}
