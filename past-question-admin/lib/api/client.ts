import { ApiError } from "./errors";
import { buildUrl, type QueryValue } from "./url";

// The URL helpers live in a dependency-free module (unit-tested in url.test.ts);
// re-export them so existing `@/lib/api/client` import sites keep working.
export { buildUrl, serializeQuery } from "./url";
export type { QueryValue } from "./url";

/**
 * Pure HTTP client for the backend API.
 *
 * Deliberately free of Next.js/`next/headers` imports so it *can* be unit-tested
 * with a mocked `fetch`; its pure URL helpers are covered in `url.test.ts`.
 * Callers pass the base URL and bearer token explicitly; the server-only wiring
 * lives in `./server.ts`.
 *
 * It understands the backend's error envelope:
 *   { success: false, error: { code, message, details? }, timestamp, path }
 * and, symmetrically, an optional success envelope { success: true, data }.
 * If a response is not enveloped, the raw JSON body is returned (for 2xx) or
 * mapped to an ApiError (for non-2xx).
 */

export interface RequestOptions {
  path: string; // relative to the base URL, must start with "/"
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown; // JSON-serialised; mutually exclusive with formData
  formData?: FormData; // multipart; fetch sets the boundary
  token?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: RequestCache;
}

interface MaybeEnvelope {
  success?: unknown;
  data?: unknown;
  error?: unknown;
}

export async function apiRequest<T>(
  baseUrl: string,
  opts: RequestOptions,
): Promise<T> {
  const url = buildUrl(baseUrl, opts.path, opts.query);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData; // do NOT set Content-Type; fetch adds the boundary
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const method = opts.method ?? (body !== undefined ? "POST" : "GET");

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body,
      signal: opts.signal,
      cache: opts.cache ?? "no-store",
    });
  } catch (cause) {
    throw new ApiError({
      kind: "network",
      message: `Could not reach the backend API at ${baseUrl}. Is the backend running and API_BASE_URL correct?`,
      cause,
    });
  }

  const text = await res.text();
  let parsed: unknown;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (res.ok) {
        throw new ApiError({
          kind: "parse",
          status: res.status,
          message: "The backend returned a response that was not valid JSON.",
        });
      }
      // Non-2xx with non-JSON body: fall through to status-based error.
    }
  }

  const envelope =
    parsed && typeof parsed === "object" ? (parsed as MaybeEnvelope) : undefined;
  const isEnveloped = envelope !== undefined && typeof envelope.success === "boolean";

  if (isEnveloped) {
    if (res.ok && envelope!.success === true) {
      return ("data" in envelope! ? envelope!.data : envelope) as T;
    }
    throw ApiError.fromResponse(res.status, envelope!.error);
  }

  if (!res.ok) {
    const errBody =
      envelope && "error" in envelope ? envelope.error : parsed;
    throw ApiError.fromResponse(res.status, errBody);
  }

  // 204 / empty body on success.
  return (parsed ?? (undefined as unknown)) as T;
}
