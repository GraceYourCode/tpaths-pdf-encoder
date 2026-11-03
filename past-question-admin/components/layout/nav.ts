import type { ComponentType } from "react";
import {
  CreditCard,
  KeyRound,
  LayoutDashboard,
  Package,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";

/** Minimal icon contract — we only ever pass `className`. */
export type NavIcon = ComponentType<{ className?: string }>;

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
}

/**
 * Primary navigation. `href` values map to routes implemented under
 * `app/(dashboard)/`. Keep this the single source of truth for the sidebar.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Products", href: "/products", icon: Package },
  { label: "Access Tokens", href: "/tokens", icon: KeyRound },
  { label: "Students", href: "/students", icon: Users },
  { label: "Purchases", href: "/purchases", icon: ShoppingBag },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Licenses", href: "/licenses", icon: ShieldCheck },
  { label: "Audit log", href: "/audit-logs", icon: ScrollText },
];

/** Whether a nav item should render as active for the current pathname. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
