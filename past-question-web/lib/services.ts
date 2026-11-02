import { apiGet, apiPatch, apiPost } from "./api";
import type {
  Device,
  License,
  PaymentVerification,
  Product,
  Purchase,
  User,
} from "./types";

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) =>
    apiPost<{ user: User; verificationToken?: string }>(
      "/api/v1/auth/register",
      body,
      false,
    ),

  login: (body: { email: string; password: string }) =>
    apiPost<{ accessToken: string; refreshToken: string; user: User }>(
      "/api/v1/auth/login",
      body,
      false,
    ),
    
  me: () => apiGet<User>("/api/v1/auth/me"),
  logout: () => apiPost<{ loggedOut: boolean }>("/api/v1/auth/logout"),
  logoutAll: () => apiPost<{ loggedOut: boolean }>("/api/v1/auth/logout-all"),
  verifyEmail: (token: string) =>
    apiPost<{ verified: boolean }>(
      "/api/v1/auth/verify-email",
      { token },
      false,
    ),
  resendVerification: (email: string) =>
    apiPost<{ sent: boolean; verificationToken?: string }>(
      "/api/v1/auth/resend-verification",
      { email },
      false,
    ),
  forgotPassword: (email: string) =>
    apiPost<{ sent: boolean; resetToken?: string }>(
      "/api/v1/auth/forgot-password",
      { email },
      false,
    ),
  resetPassword: (token: string, password: string) =>
    apiPost<{ reset: boolean }>(
      "/api/v1/auth/reset-password",
      { token, password },
      false,
    ),
};

export const productsApi = {
  list: (params = "") =>
    apiGet<{
      items: Product[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(`/api/v1/products${params ? `?${params}` : ""}`, false),
  get: (id: string) =>
    apiGet<Product>(`/api/v1/products/${encodeURIComponent(id)}`, false),
};

export const accountApi = {
  me: () => apiGet<User>("/api/v1/users/me"),
  update: (body: {
    firstName?: string;
    lastName?: string;
    password?: string;
  }) => apiPatch<User>("/api/v1/users/me", body),
  purchases: () => apiGet<Purchase[]>("/api/v1/users/me/purchases"),
  licenses: () => apiGet<License[]>("/api/v1/users/me/licenses"),
  devices: () => apiGet<Device[]>("/api/v1/users/me/devices"),
};

export const paymentApi = {
  verify: (body: { reference: string; productId: string; amount?: number }) =>
    apiPost<PaymentVerification>("/api/v1/payments/verify", body),
};

export const licenseApi = {
  list: () => apiGet<License[]>("/api/v1/licenses"),
  get: (id: string) =>
    apiGet<License>(`/api/v1/licenses/${encodeURIComponent(id)}`),
};
