/**
 * Product form parsing shared by the create and update Server Actions.
 *
 * Kept out of `app/actions/products.ts` because a `"use server"` module may
 * only export async functions. Pure: runs under `node --test`.
 */

import { PRODUCT_STATUSES, type ProductInput, type ProductStatus } from "../api/types.ts";
import { parseNairaToKobo } from "../money.ts";

/** The backend only prices in NGN today; the form submits it explicitly. */
export const PRODUCT_CURRENCY = "NGN";
export const MAX_TITLE_LENGTH = 200;

export type ProductFormField = "title" | "status" | "price";
export type ProductFieldErrors = Partial<Record<ProductFormField, string>>;

export interface ProductFormValues {
  title: string;
  description: string;
  courseCode: string;
  institution: string;
  level: string;
  status: string;
  price: string;
}

export interface ParsedProductForm {
  values: ProductFormValues;
  fieldErrors: ProductFieldErrors;
  /** Present only when every field is valid. */
  input?: ProductInput;
}

export function readProductForm(formData: FormData): ParsedProductForm {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const courseCode = String(formData.get("course") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "draft").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();

  const values: ProductFormValues = {
    title,
    description,
    courseCode,
    institution,
    level,
    status: statusRaw,
    price: priceRaw,
  };
  const fieldErrors: ProductFieldErrors = {};

  if (!title) fieldErrors.title = "Title is required.";
  else if (title.length > MAX_TITLE_LENGTH) {
    fieldErrors.title = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }

  const status = (PRODUCT_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as ProductStatus)
    : undefined;
  if (!status) fieldErrors.status = "Choose a valid status.";

  const price = parseNairaToKobo(priceRaw);
  if (!price.ok) fieldErrors.price = price.error;

  if (Object.keys(fieldErrors).length > 0 || !status || !price.ok) {
    return { values, fieldErrors };
  }

  return {
    values,
    fieldErrors,
    input: {
      title,
      description: description || null,
      course: courseCode || null,
      institution: institution || null,
      level: level || null,
      status,
      priceKobo: price.kobo,
      currency: PRODUCT_CURRENCY,
    },
  };
}
