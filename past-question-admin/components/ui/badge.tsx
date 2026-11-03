import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent text-accent-foreground",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Maps a domain status string to a sensible badge tone. Unknown values render
 * neutral rather than throwing, so a new backend status never crashes the UI.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  // products
  published: "success",
  draft: "neutral",
  archived: "warning",
  // tokens
  active: "success",
  unused: "info",
  redeemed: "info",
  revoked: "danger",
  expired: "warning",
  // students
  suspended: "danger",
  pending: "info",
  // documents
  ready: "success",
  processing: "info",
  disabled: "warning",
  deleted: "neutral",
  failed: "danger",
  // purchases and payments
  paid: "success",
  success: "success",
  cancelled: "neutral",
  refunded: "warning",
  // licenses and devices reuse the states above (ACTIVE, SUSPENDED, REVOKED, EXPIRED)
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge tone={tone}>{label}</Badge>;
}
