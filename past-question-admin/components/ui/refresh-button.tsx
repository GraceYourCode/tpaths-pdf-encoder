"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

/**
 * Re-runs the current route's server render (`router.refresh()`), used as the
 * "Try again" action on error states. Shows a real pending state while the
 * refresh is in flight.
 */
export function RefreshButton({
  children = "Try again",
  variant = "outline",
  size,
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      loading={pending}
      leadingIcon={<RefreshCw className="h-4 w-4" />}
      onClick={() => startTransition(() => router.refresh())}
    >
      {children}
    </Button>
  );
}
