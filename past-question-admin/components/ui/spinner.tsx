import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Indeterminate loading spinner. Decorative by default; pass a `label` for a11y. */
export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <>
      <Loader2
        className={cn("h-4 w-4 animate-spin", className)}
        aria-hidden="true"
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
