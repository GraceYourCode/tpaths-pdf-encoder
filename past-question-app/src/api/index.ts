import { api, binary } from "./client";
import type {
  AuthResult,
  ContentAuth,
  Device,
  License,
  Product,
  User,
} from "@/types";

export const auth = {
  register: (x: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    whatsapp: string;
  }) =>
    api<{ user: User; verificationToken?: string }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(x),
    }),

  login: (email: string, password: string) =>
    api<AuthResult>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => api<User>("/api/v1/auth/me"),

  logout: () => api("/api/v1/auth/logout", { method: "POST" }),
  resend: (email: string) =>
    api("/api/v1/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
};

export const users = {
  me: () => api<User>("/api/v1/users/me"),
  licenses: () => api<License[]>("/api/v1/users/me/licenses"),
  devices: () => api<Device[]>("/api/v1/users/me/devices"),
};
export const products = {
  get: (id: string) =>
    api<Product>(`/api/v1/products/${encodeURIComponent(id)}`),
};
export const devices = {
  register: (x: {
    deviceId: string;
    platform: string;
    appVersion: string;
    publicKey: string;
  }) =>
    api<Device>("/api/v1/devices/register", {
      method: "POST",
      body: JSON.stringify(x),
    }),
};
export const licenses = {
  list: () => api<License[]>("/api/v1/licenses"),
  get: (id: string) =>
    api<License>(`/api/v1/licenses/${encodeURIComponent(id)}`),
  activate: (token: string, deviceId: string) =>
    api<License>("/api/v1/licenses/activate", {
      method: "POST",
      body: JSON.stringify({ token, deviceId }),
    }),
  validate: (id: string, deviceId: string) =>
    api(`/api/v1/licenses/${id}/validate`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),
};
export const content = {
  authorize: (id: string, deviceId: string) =>
    api<ContentAuth>(`/api/v1/content/${id}/access`, {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    }),
  artifact: (id: string, t: string) =>
    binary(`/api/v1/content/${id}/artifact`, t),
};
