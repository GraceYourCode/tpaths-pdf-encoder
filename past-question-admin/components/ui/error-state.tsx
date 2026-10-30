import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeError } from "@/lib/api/errors";

/**
 * Honest error surface. Given a thrown value (usually an `ApiError`), it renders
 * a safe title + message via `describeError` — never a stack trace or secret.
 * Pass `action` (e.g. a retry link/button) for recovery.
 */
export function ErrorState({
  error,
  action,
  className,
}: {
  error: unknown;
  action?: ReactNode;
  className?: string;
}) {
  const { title, message } = describeError(error);
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/40 bg-danger-bg/40 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {message}
        </p>
      </div>
      {action}
    </div>
  );
}

/** Compact inline variant for embedding inside cards/sections. */
export function InlineError({
  error,
  className,
}: {
  error: unknown;
  className?: string;
}) {
  const { message } = describeError(error);
  return (
    <p
      role="alert"
      className={cn(
        "flex items-center gap-2 rounded-md border border-danger/40 bg-danger-bg/40 px-3 py-2 text-sm text-danger",
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-foreground">{message}</span>
    </p>
  );
}
