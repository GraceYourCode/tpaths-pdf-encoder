/**
 * PDF upload contract for the admin console.
 *
 * The backend (POST /admin/products/:id/documents) requires multipart fields
 * `file` and `title` and REJECTS unknown fields, so this module deliberately
 * never adds a `status`. Document lifecycle is server-owned: a new upload is
 * created by the backend and its status is returned in the response.
 *
 * Pure module: runs under `node --test`.
 */

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_TITLE_LENGTH = 200;

export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
}

export type UploadCheck = { ok: true } | { ok: false; error: string };

/** Client-side pre-checks. The backend re-checks MIME, size and %PDF- magic bytes. */
export function checkPdfUpload(file: UploadCandidate | null | undefined): UploadCheck {
  if (!file || file.size === 0) {
    return { ok: false, error: "Choose a PDF file to upload." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { ok: false, error: "Only PDF files are allowed." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "That file exceeds the 25 MB limit." };
  }
  return { ok: true };
}

/** Document title from the uploaded file name: no path, trimmed, bounded. */
export function documentTitleFromFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const trimmed = base.trim() || "Past-question PDF";
  return trimmed.slice(0, MAX_DOCUMENT_TITLE_LENGTH);
}

/** Build the exact multipart payload the backend accepts: `file` + `title` only. */
export function buildDocumentUploadForm(file: Blob & { name: string }, title: string): FormData {
  const payload = new FormData();
  payload.append("file", file, file.name);
  payload.append("title", title);
  return payload;
}
