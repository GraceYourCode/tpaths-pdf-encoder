"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/api/auth";
import { describeError } from "@/lib/api/errors";
import { safeNext } from "@/lib/safe-next";
import { establishSession } from "@/lib/session";

/**
 * Authentication Server Actions.
 *
 * SECURITY: These only relay to the backend, which owns all authentication.
 * We never verify credentials or mint tokens in the frontend. On success the
 * backend-issued token is stored in an httpOnly cookie by `establishSession`.
 * The backend owns password verification, token minting, and authorization. The
 * frontend only stores the returned tokens in httpOnly cookies.
 */

export interface LoginFormState {
  /** Top-level error (bad credentials, backend unreachable, endpoint missing…). */
  error?: string;
  /** Per-field validation messages. */
  fieldErrors?: { email?: string; password?: string };
  /** Echoed values so the form can repopulate after a failed submit. */
  values?: { email?: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const fieldErrors: { email?: string; password?: string } = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (!EMAIL_RE.test(email))
    fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Password is required.";
  if (fieldErrors.email || fieldErrors.password) {
    return { fieldErrors, values: { email } };
  }

  let result;
  try {
    result = await login({ email, password });
  } catch (err) {
    return { error: describeError(err).message, values: { email } };
  }

  if (!result?.accessToken) {
    return {
      error:
        "The backend did not return an access token, so the session could not be created.",
      values: { email },
    };
  }

  await establishSession({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? null,
    admin: result.admin ?? null,
    maxAgeSeconds: result.expiresIn ?? undefined,
  });

  // Throws a framework control-flow exception; nothing after runs.
  redirect(next);
}
