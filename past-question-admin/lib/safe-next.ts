/**
 * Open-redirect guard for post-login (and similar) `next` redirect targets.
 *
 * Only same-site absolute paths are allowed: a single leading "/", no scheme,
 * no protocol-relative "//host", and no backslashes (which some browsers
 * normalise to "/"). Anything else falls back to a safe default. Pure and
 * dependency-free so it can be unit-tested (see `safe-next.test.ts`).
 */
export function safeNext(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}
