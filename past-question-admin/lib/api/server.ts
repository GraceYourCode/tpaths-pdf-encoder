import { cookies } from "next/headers";
import { getServerEnv } from "../env";
import { apiRequest, type RequestOptions } from "./client";

export type BackendRequestOptions = Omit<RequestOptions, "token"> & {
  token?: string | null;
  authenticated?: boolean;
};

export async function backendRequest<T>(opts: BackendRequestOptions): Promise<T> {
  const { authenticated = true, token, ...rest } = opts;
  let resolvedToken = token;
  if (resolvedToken === undefined && authenticated) {
    const store = await cookies();
    resolvedToken = store.get(getServerEnv().sessionCookieName)?.value ?? null;
  }
  return apiRequest<T>(getServerEnv().apiBaseUrl, { ...rest, token: resolvedToken });
}
