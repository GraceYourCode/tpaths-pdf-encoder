"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard error boundary (Next.js 16: props are `{ error, retry }`).
 *
 * Most expected API failures are handled *inside* each page with an inline
 * `ErrorState`, so this boundary catches only unexpected render errors. We show
 * a generic, safe message — never a stack trace. In production Next strips the
 * error message and provides only `digest`, which we surface for support.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          Something went wrong
        </p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          This page failed to load. You can try again, or return to the overview.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
