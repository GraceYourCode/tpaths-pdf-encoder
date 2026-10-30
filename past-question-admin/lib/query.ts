/** Tiny helpers for reading Next.js `searchParams` values safely. */

/** Parse a 1-based page number; anything invalid falls back to 1. */
export function toPageNumber(value: string | string[] | undefined): number {
  const raw = firstStr(value);
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Coerce a possibly-array search param to its first string value. */
export function firstStr(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}
