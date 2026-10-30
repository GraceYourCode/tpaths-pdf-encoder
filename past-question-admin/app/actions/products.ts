"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeError } from "@/lib/api/errors";
import {
  createProduct,
  deleteProduct,
  deleteProductDocument,
  updateProduct,
  uploadProductDocument,
} from "@/lib/api/products";
import { PRODUCT_STATUSES, type ProductInput, type ProductStatus } from "@/lib/api/types";
import { requireSession } from "@/lib/session";

/**
 * Product mutation Server Actions.
 *
 * SECURITY: every action re-asserts the session (`requireSession`) so the
 * backend token is present and forwarded; the backend re-validates it and is
 * the real authorization boundary. All of these call not-yet-implemented
 * implemented backend endpoints and returns safe, typed errors to the UI.
 *
 * PDF uploads are streamed to the backend from the server (never browser →
 * storage), and we surface a real pending state — no fabricated progress.
 */

export interface ProductFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"title" | "status", string>>;
  values?: Record<string, string>;
}

export interface SimpleActionState {
  ok?: boolean;
  error?: string;
}

export interface DocumentActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function readProductForm(formData: FormData): {
  values: Record<string, string>;
  fieldErrors: ProductFormState["fieldErrors"];
  input?: ProductInput;
} {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const courseCode = String(formData.get("course") ?? "").trim();
  const institution = String(formData.get("institution") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "draft").trim();

  const values = {
    title,
    description,
    courseCode,
    institution,
    level,
    status: statusRaw,
  };
  const fieldErrors: ProductFormState["fieldErrors"] = {};

  if (!title) fieldErrors.title = "Title is required.";



  const status = (PRODUCT_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as ProductStatus)
    : undefined;
  if (!status) fieldErrors.status = "Choose a valid status.";

  if (Object.keys(fieldErrors).length > 0) return { values, fieldErrors };

  return {
    values,
    fieldErrors,
    input: {
      title,
      description: description || null,
      course: courseCode || null,
      institution: institution || null,
      level: level || null,
      status: status as ProductStatus,
    },
  };
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireSession();
  const { values, fieldErrors, input } = readProductForm(formData);
  if (!input) return { fieldErrors, values };

  let created;
  try {
    created = await createProduct(input);
  } catch (err) {
    return { error: describeError(err).message, values };
  }

  revalidatePath("/products");
  redirect(`/products/${created.id}`);
}

export async function updateProductAction(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireSession();
  const { values, fieldErrors, input } = readProductForm(formData);
  if (!input) return { fieldErrors, values };

  try {
    await updateProduct(id, input);
  } catch (err) {
    return { error: describeError(err).message, values };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, values };
}

export async function deleteProductAction(
  id: string,
): Promise<SimpleActionState> {
  await requireSession();
  try {
    await deleteProduct(id);
  } catch (err) {
    return { error: describeError(err).message };
  }
  revalidatePath("/products");
  redirect("/products");
}

export async function uploadDocumentAction(
  id: string,
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  await requireSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file to upload." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { error: "Only PDF files are allowed." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "That file exceeds the 25 MB limit." };
  }

  // Forward a clean multipart payload to the backend, which stores the file
  // privately and returns opaque metadata (no public URL).
  const payload = new FormData();
  payload.set("file", file);
  payload.set("title", file.name);
  payload.set("status", "ACTIVE");

  let doc;
  try {
    doc = await uploadProductDocument(id, payload);
  } catch (err) {
    return { error: describeError(err).message };
  }

  revalidatePath(`/products/${id}`);
  return { ok: true, message: `Uploaded ${doc.fileName}.` };
}

export async function deleteDocumentAction(
  documentId: string,
): Promise<DocumentActionState> {
  await requireSession();
  try {
    await deleteProductDocument(documentId);
  } catch (err) {
    return { error: describeError(err).message };
  }
  revalidatePath("/products");
  return { ok: true, message: "Document removed." };
}
