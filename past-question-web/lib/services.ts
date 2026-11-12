import { apiGet, apiPatch, apiPost, getAccessToken, sessionRequest } from "./api";
import type {
  Device,
  License,
  PaymentInitialization,
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
    whatsapp: string;
  }) =>
    apiPost<{ user: User; verificationToken?: string }>(
      "/api/v1/auth/register",
      body,
      false,
    ),

  /** Goes through the same-origin session route so the refresh token stays in an HTTP-only cookie. */
  login: (body: { email: string; password: string }) =>
    sessionRequest<{ accessToken: string; user: User }>("login", body),

  me: () => apiGet<User>("/api/v1/auth/me"),

  /** Clears the refresh cookie. The backend session is revoked on a best-effort basis. */
  logout: () => {
    const token = getAccessToken();
    return sessionRequest<{ loggedOut: boolean }>(
      "logout",
      undefined,
      token ? { Authorization: `Bearer ${token}` } : {},
    );
  },

  /** Revokes every backend session for this account. Pair with logout() to clear local cookies. */
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
  /** Owner-only. A revoked device cannot be registered again, and its licence artifacts stop working. */
  revokeDevice: (id: string) =>
    apiPost<{ revoked: boolean }>(`/api/v1/devices/${encodeURIComponent(id)}/revoke`),
};

export const paymentApi = {
  /**
   * Creates the PENDING purchase and provider transaction on the server. The
   * returned accessCode is handed to the Paystack SDK, so amount and reference
   * are always server-controlled.
   */
  initialize: (productId: string) =>
    apiPost<PaymentInitialization>("/api/v1/payments/initialize", { productId }),

  /** Confirms the purchase the server already created for this reference. */
  /** Idempotent on the server: repeat calls return the same purchase without a second activation token. */
  verify: (body: { reference: string; productId: string }) =>
    apiPost<PaymentVerification>("/api/v1/payments/verify", body),
};

