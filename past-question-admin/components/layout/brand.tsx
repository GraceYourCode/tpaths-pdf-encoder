import { cn } from "@/lib/utils";

/**
 * TPaths brand.
 *
 * `BrandMark` is a hexagonal shield with a bold "T" — a clean, self-drawn
 * approximation of the TPaths logo (the brand's real mark pairs the hexagon
 * with a "PATHS" label that is illegible at UI sizes, so it is intentionally
 * omitted here; the wordmark carries the name). The hexagon uses `currentColor`
 * so it inherits a violet tone on any background; the "T" is a light cut-out.
 *
 * To use the real logo, drop an SVG into `public/` and swap `BrandMark`'s body
 * for an <Image>/<img> — every call site goes through this component.
 *
 * `Brand` pairs the mark with the "TPaths" wordmark set in the brand serif
 * (Lora), bold italic, matching the website's wordmark.
 */

export function BrandMark({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-primary", className)}
      fill="none"
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": "TPaths" })}
    >
      <polygon
        points="10,3.4 22,3.4 28.4,16 22,28.6 10,28.6 3.6,16"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <rect x="9.4" y="10" width="13.2" height="3.5" rx="1.2" fill="#ffffff" />
      <rect x="14.25" y="10" width="3.5" height="12.6" rx="1.2" fill="#ffffff" />
    </svg>
  );
}

export function Brand({
  showWordmark = true,
  className,
  markClassName,
  wordmarkClassName,
}: {
  showWordmark?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className={cn("h-8 w-8", markClassName)} decorative={showWordmark} />
      {showWordmark ? (
        <span
          className={cn(
            "font-serif text-xl font-bold italic tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          TPaths
        </span>
      ) : null}
    </span>
  );
}
