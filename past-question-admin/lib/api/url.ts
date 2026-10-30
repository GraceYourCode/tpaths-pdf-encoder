/**
 * Pure URL-building helpers for the API client.
 *
 * Extracted into their own dependency-free module so they can be unit-tested
 * with Node's native test runner (see `url.test.ts`) without loading anything
 * that imports `next/*`.
 */

export type QueryValue = string | number | boolean | null | undefined;

/** Join a base URL, a relative path, and an optional query object into a URL. */
export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  const qs = query ? serializeQuery(query) : "";
  return `${base}${rel}${qs}`;
}

/**
 * Serialise a query object to a `?a=b&c=d` string. `undefined`, `null`, and
 * empty-string values are omitted so we never send `?search=`.
 */
export function serializeQuery(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
