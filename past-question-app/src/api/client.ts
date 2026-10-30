import { API_URL } from "@/config";
import { access, session, saveSession, clearSession } from "@/storage/secure";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
let refreshing: Promise<string | null> | null = null;
async function refresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const s = await session();
    if (!s) return null;
    try {
      const r = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: s.refreshToken }),
      });
      if (!r.ok) {
        await clearSession();
        return null;
      }
      const b = (await r.json()) as {
        data?: { accessToken?: string; refreshToken?: string };
        accessToken?: string;
        refreshToken?: string;
      };
      const d =
        b.data?.accessToken && b.data?.refreshToken
          ? {
              accessToken: b.data.accessToken,
              refreshToken: b.data.refreshToken,
            }
          : b.accessToken && b.refreshToken
            ? { accessToken: b.accessToken, refreshToken: b.refreshToken }
            : null;
      if (!d) {
        await clearSession();
        return null;
      }
      await saveSession(d.accessToken, d.refreshToken);
      return d.accessToken;
    } catch {
      await clearSession();
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
async function parse(r: Response): Promise<unknown> {
  const t = r.headers.get("content-type") ?? "";
  return t.includes("json") ? r.json() : r.text();
}
export async function api<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const h = new Headers(init.headers);
  if (init.body) h.set("content-type", "application/json");
  const a = await access();
  if (a) h.set("Authorization", `Bearer ${a}`);
  let r: Response;
  try {
    r = await fetch(`${API_URL}${path}`, { ...init, headers: h });
  } catch {
    throw new ApiError(
      0,
      "Unable to connect. Check your internet connection and try again.",
    );
  }
  if (r.status === 401 && retry && !path.includes("/auth/refresh")) {
    if (await refresh()) return api<T>(path, init, false);
  }
  if (!r.ok) {
    const b = (await parse(r)) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    const e = b?.error;
    throw new ApiError(
      r.status,
      String(e?.message ?? b?.message ?? "Request failed"),
      e?.code,
    );
  }
  const b = (await parse(r)) as { success?: boolean; data?: T };
  return (b?.success === true && "data" in b ? b.data : b) as T;
}

export async function binary(path: string, contentToken: string) {
  const a = await access();
  const h = new Headers({ "X-Content-Authorization": contentToken });
  if (a) h.set("Authorization", `Bearer ${a}`);
  let r: Response;
  try {
    r = await fetch(`${API_URL}${path}`, { headers: h });
  } catch {
    throw new ApiError(
      0,
      "Unable to connect. Check your internet connection and try again.",
    );
  }
  if (!r.ok) {
    const b = (await parse(r)) as {
      error?: { message?: string };
      message?: string;
    };
    throw new ApiError(
      r.status,
      String(b?.error?.message ?? b?.message ?? "Document download failed"),
    );
  }
  return { bytes: new Uint8Array(await r.arrayBuffer()), headers: r.headers };
}
