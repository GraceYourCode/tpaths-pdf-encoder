import Constants from "expo-constants";
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const required = (name: string, value: unknown) => {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v || v.includes("REPLACE_WITH"))
    throw new Error(`${name} is not configured. Set EXPO_PUBLIC_${name}.`);
  return v.replace(/\/$/, "");
};

export const API_URL = required(
  "API_URL",
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl,
);

export const WEBSITE_URL = required(
  "WEBSITE_URL",
  process.env.EXPO_PUBLIC_WEBSITE_URL ?? extra.websiteUrl,
);

export const APP_VERSION = String(Constants.expoConfig?.version ?? "1.0.0");

/** ES256 verification keys are public and pinned in the shipped app configuration.
 * Format: JSON object mapping JWS `kid` values to PEM SubjectPublicKeyInfo keys.
 * An empty map intentionally disables offline leases until the backend key is provisioned.
 */
export function offlineLeasePublicKeys(): Record<string, string> {
  const raw = process.env.EXPO_PUBLIC_OFFLINE_LEASE_PUBLIC_KEYS ?? extra.offlineLeasePublicKeys;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const keys: Record<string, string> = {};
    for (const [kid, value] of Object.entries(parsed)) {
      if (/^[A-Za-z0-9._-]{1,64}$/.test(kid) && typeof value === "string" && value.includes("BEGIN PUBLIC KEY")) {
        keys[kid] = value.replace(/\\n/g, "\n");
      }
    }
    return keys;
  } catch { return {}; }
}
