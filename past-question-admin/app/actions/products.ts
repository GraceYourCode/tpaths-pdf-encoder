"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { describeError } from "@/lib/api/errors";
import {
  archiveProduct,
  createProduct,
  disableProductDocument,
  getProduct,
  removeProductDocument,
  updateProduct,
  uploadProductDocument,
} from "@/lib/api/products";
import { mapDocument } from "@/lib/api/types";
import { readProductForm, type ProductFieldErrors, type ProductFormValues } from "@/lib/products/form";
import {
  buildDocumentUploadForm,
  checkPdfUpload,
  documentTitleFromFileName,
} from "@/lib/products/upload";
import { requireSession } from "@/lib/session";

/**
 * Product and document mutation Server Actions.
 *
 * SECURITY: every action re-asserts the session (`requireSession`) so the
 * backend token is present and forwarded; the backend re-validates it and is
 * the real authorization boundary. PDFs are streamed from this server to the
 * backend; the browser never uploads to storage and never receives a PDF URL.
 */

export interface ProductFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: ProductFieldErrors;
  values?: Partial<ProductFormValues>;
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

/** Archives the product. The backend never hard-deletes catalogue rows. */
export async function deleteProductAction(id: string): Promise<SimpleActionState> {
  await requireSession();
  try {
    await archiveProduct(id);
  } catch (err) {
    return { error: describeError(err).message };
  }
  revalidatePath("/products");
  redirect("/products");
}

/**
 * Uploads a new PDF version for a product.
 *
 * Order matters:
 *  1. Snapshot the product's existing versions (so the new one is not retired).
 *  2. Upload. The backend validates MIME, magic bytes and size, then returns the
 *     new document with its real lifecycle status.
 *  3. Retire previously READY versions so students only ever reach the newest.
 *     A failure here is reported, never hidden.
 */
export async function uploadDocumentAction(
  id: string,
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  await requireSession();

  const file = formData.get("file");
  const check = checkPdfUpload(file instanceof File ? file : null);
  if (!check.ok) return { error: check.error };
  const upload = file as File;
  const title = documentTitleFromFileName(upload.name);

  let before;
  try {
    before = await getProduct(id);
  } catch (err) {
    return { error: describeError(err).message };
  }
  const previouslyReady = (before.documents ?? []).filter((d) => d.status === "ready");

  let created;
  try {
    created = await uploadProductDocument(id, buildDocumentUploadForm(upload, title));
  } catch (err) {
    return { error: describeError(err).message };
  }
  const doc = mapDocument(created);
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");

  if (!doc) return { error: "The backend did not return the uploaded document." };
  if (doc.status === "failed") {
    return {
      error: doc.failureReason
        ? `Processing failed: ${doc.failureReason}`
        : "The backend could not process this PDF. Try uploading it again.",
    };
  }

  const retireFailures: string[] = [];
  for (const prev of previouslyReady) {
    try {
      await disableProductDocument(prev.id, prev.fileName);
    } catch {
      retireFailures.push(`${prev.fileName} (v${prev.version})`);
    }
  }

  const statusNote =
    doc.status === "ready"
      ? "It is ready for students."
      : "It is still processing; students cannot access it until processing finishes.";
  const message = `Uploaded ${doc.fileName} as version ${doc.version}. ${statusNote}`;

  if (retireFailures.length > 0) {
    return {
      ok: true,
      message,
      error: `The new version is live, but these earlier versions could not be disabled and may still be accessible: ${retireFailures.join(", ")}. Disable them manually.`,
    };
  }
  return { ok: true, message };
}

/**
 * Removes a document. The backend marks it DISABLED (students lose access) and
 * keeps the row for audit; it does not hard-delete.
 */
export async function deleteDocumentAction(
  documentId: string,
  productId: string,
  _prev: DocumentActionState,
  _formData: FormData,
): Promise<DocumentActionState> {
  await requireSession();
  try {
    await removeProductDocument(documentId);
  } catch (err) {
    return { error: describeError(err).message };
  }
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return {
    ok: true,
    message: "PDF removed. Students can no longer access this version; the record is kept for audit.",
  };
}
