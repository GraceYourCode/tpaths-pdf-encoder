import Link from "next/link";
import { buttonClasses } from "./button";

/**
 * Simple prev/next pagination rendered as links (server-friendly). Preserves
 * the current filter query params across page changes.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  query = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={href(page + 1)}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
