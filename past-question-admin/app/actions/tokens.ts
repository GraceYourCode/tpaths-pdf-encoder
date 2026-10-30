"use server";

import { revalidatePath } from "next/cache";
import { describeError } from "@/lib/api/errors";
import { generateToken, revokeToken } from "@/lib/api/tokens";
import { requireSession } from "@/lib/session";

export interface TokenGenerateState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"productId" | "quantity", string>>;
  codes?: string[];
}

export interface SimpleActionState { ok?: boolean; error?: string; }

export async function generateTokensAction(_prev: TokenGenerateState, formData: FormData): Promise<TokenGenerateState> {
  await requireSession();
  const productId = String(formData.get("productId") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "1").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "").trim();
  const fieldErrors: TokenGenerateState["fieldErrors"] = {};
  if (!productId) fieldErrors.productId = "Select a product.";
  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) fieldErrors.quantity = "Enter a quantity between 1 and 500.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const codes: string[] = [];
  try {
    // The backend exposes single-token creation, so a requested batch is mapped
    // to repeated calls. The plaintext value from each call is returned only in
    // this one Server Action result and is never persisted by the frontend.
    for (let i = 0; i < quantity; i += 1) {
      const result = await generateToken({ productId, expiresAt: expiresAt || null });
      codes.push(result.plaintextCode);
    }
  } catch (err) {
    return { error: codes.length ? `${codes.length} token(s) generated before the request failed. Copy them below and try again.` : describeError(err).message, codes: codes.length ? codes : undefined };
  }
  revalidatePath("/tokens");
  return { ok: true, codes };
}

export async function revokeTokenAction(id: string): Promise<SimpleActionState> {
  await requireSession();
  try { await revokeToken(id); } catch (err) { return { error: describeError(err).message }; }
  revalidatePath("/tokens");
  return { ok: true };
}
