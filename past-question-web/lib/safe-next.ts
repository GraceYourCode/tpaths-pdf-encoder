/**
 * Open-redirect guard for post-login redirect targets (`?next=`).
 * Only same-site absolute paths are allowed: one leading "/", no scheme, no
 * protocol-relative "//host", and no backslashes.
 */
export function safeNext(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}
