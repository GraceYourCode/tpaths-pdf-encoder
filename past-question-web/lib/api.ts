import type { ApiError } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');

if (!API_URL) {
  // Fail early in the browser with a useful configuration error.
  console.warn('NEXT_PUBLIC_API_URL is not configured.');
}

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

function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('tpaths_refresh_token');
}

export function storeRefreshToken(token: string) {
  window.localStorage.setItem('tpaths_refresh_token', token);
}

export function clearSessionTokens() {
  accessToken = null;
  if (typeof window !== 'undefined') window.localStorage.removeItem('tpaths_refresh_token');
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = body as ApiError;
    throw new Error(error?.error?.message ?? error?.message ?? 'Request failed.');
  }
  return body as T;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getApiUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: refreshToken }),
      });
      if (!response.ok) throw new Error('Session refresh failed');
      const data = await parseResponse<{ accessToken: string; refreshToken: string }>(response);
      accessToken = data.accessToken;
      storeRefreshToken(data.refreshToken);
      return data.accessToken;
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

  const response = await fetch(`${getApiUrl()}${path}`, { ...init, headers, cache: 'no-store' });
  if (response.status === 401 && auth && retry) {
    const next = await refreshAccessToken();
    if (next) return apiFetch<T>(path, init, { auth, retry: false });
    throw new Error('Your session has expired. Please log in again.');
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
