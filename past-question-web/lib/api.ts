import type { ApiError } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

if (!API_URL) {
  // Fail early in the browser with a useful configuration error.
  console.warn('NEXT_PUBLIC_API_URL is not configured.');
}

/**
 * Error thrown for any failed API call. Carries the HTTP status and the backend
 * machine-readable code when one is present, so screens can branch on them
 * instead of parsing message text.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  /** Field-level validation messages from the backend (400), when present. */
  readonly details?: string[];
  /** Seconds to wait, from a Retry-After header on a 429 response. */
  readonly retryAfterSeconds?: number;

  constructor(message: string, status: number, code?: string, details?: string[], retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const NETWORK_MESSAGE = 'Unable to reach the server. Check your connection and try again.';

/**
 * Token handling.
 *
 * The access token lives only in memory, so it is lost on page reload and is
 * re-issued by the session route. The refresh token is never readable by
 * JavaScript: it sits in an HTTP-only cookie that the same-origin /api/session
 * routes read and rotate.
 */
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getApiUrl() {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  return API_URL;
}

/** Forgets the in-memory access token. Cookies are cleared by /api/session/logout. */
export function clearSessionTokens() {
  accessToken = null;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiRequestError(NETWORK_MESSAGE, 0);
  }
}

/**
 * The backend collapses validation failures to "Request validation failed" and puts
 * the field messages in `details`. Those are the useful ones to show.
 */
function messageFor(status: number, error: ApiError | undefined): { message: string; details?: string[] } {
  const rawDetails = error?.error?.details;
  const details = Array.isArray(rawDetails) ? rawDetails.filter((d): d is string => typeof d === 'string') : undefined;
  if (details && details.length > 0 && status === 400) return { message: details[0], details };

  if (status === 429) return { message: 'Too many attempts. Please wait a moment and try again.', details };
  if (status >= 500) return { message: 'The server could not complete the request. Please try again.', details };
  return { message: error?.error?.message ?? error?.message ?? 'Request failed.', details };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');
  if (!response.ok) {
    const error = (body ?? {}) as ApiError;
    const { message, details } = messageFor(response.status, error);
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ApiRequestError(
      message,
      response.status,
      error?.error?.code,
      details,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }
  return body as T;
}

/** Calls the same-origin session routes that manage the HTTP-only refresh cookie. */
export async function sessionRequest<T>(
  action: 'login' | 'refresh' | 'logout',
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const response = await send(`/api/session/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

/**
 * Obtains a new access token from the session route. Concurrent callers share one
 * in-flight request, so a rotating refresh token is never used twice in one tab.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const data = await sessionRequest<{ accessToken: string }>('refresh');
      accessToken = data.accessToken;
      return accessToken;
    } catch {
      clearSessionTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, options: { auth?: boolean; retry?: boolean } = {}) {
  const auth = options.auth ?? true;
  const retry = options.retry ?? true;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await send(`${getApiUrl()}${path}`, { ...init, headers, cache: 'no-store' });
  if (response.status === 401 && auth && retry) {
    const next = await refreshAccessToken();
    if (next) return apiFetch<T>(path, init, { auth, retry: false });
    throw new ApiRequestError('Your session has expired. Please log in again.', 401);
  }
  return parseResponse<T>(response);
}

export async function apiGet<T>(path: string, auth = true) {
  return apiFetch<T>(path, { method: 'GET' }, { auth });
}

export async function apiPost<T>(path: string, body?: unknown, auth = true) {
  return apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, { auth });
}

export async function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

/** Text to show a student for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** True when the backend says this exact purchase or licence already exists. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 409;
}
