import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/** Rendered by `notFound()` and unmatched dashboard routes. */
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">Not found</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          The page or resource you were looking for doesn&apos;t exist.
        </p>
      </div>
      <Link href="/" className={buttonClasses({ variant: "outline" })}>
        Back to overview
      </Link>
    </div>
  );
}
