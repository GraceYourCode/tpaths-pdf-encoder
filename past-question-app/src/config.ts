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
