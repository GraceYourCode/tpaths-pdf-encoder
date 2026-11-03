"use server";

import { revalidatePath } from "next/cache";
import { describeError } from "@/lib/api/errors";
import { setLicenseStatus } from "@/lib/api/finance";
import { requireSession } from "@/lib/session";

export interface LicenseActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Suspend or revoke a license. Revocation is terminal on the backend; the UI
 * asks for confirmation before calling this action.
 */
export async function setLicenseStatusAction(
  licenseId: string,
  action: "suspend" | "revoke",
  _prev: LicenseActionState,
  _formData: FormData,
): Promise<LicenseActionState> {
  await requireSession();
  try {
    await setLicenseStatus(licenseId, action);
  } catch (err) {
    return { error: describeError(err).message };
  }
  revalidatePath("/licenses");
  revalidatePath(`/licenses/${licenseId}`);
  return { ok: true, message: action === "revoke" ? "License revoked." : "License suspended." };
}
