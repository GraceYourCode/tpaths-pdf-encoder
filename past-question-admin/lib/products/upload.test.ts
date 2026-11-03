import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDocumentUploadForm,
  checkPdfUpload,
  documentTitleFromFileName,
  MAX_PDF_BYTES,
} from "./upload.ts";

test("a PDF within the limit passes the client pre-check", () => {
  assert.deepEqual(checkPdfUpload({ name: "a.pdf", size: 1024, type: "application/pdf" }), { ok: true });
  assert.deepEqual(checkPdfUpload({ name: "a.pdf", size: 1024, type: "" }), { ok: true }, "missing MIME is left to the backend magic-byte check");
});

test("missing or empty files are rejected", () => {
  assert.equal(checkPdfUpload(null).ok, false);
  assert.equal(checkPdfUpload({ name: "a.pdf", size: 0, type: "application/pdf" }).ok, false);
});

test("non-PDF MIME types are rejected before any network call", () => {
  const result = checkPdfUpload({ name: "a.docx", size: 10, type: "application/vnd.openxmlformats" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Only PDF files are allowed.");
});

test("files over 25 MB are rejected at the exact boundary", () => {
  assert.equal(checkPdfUpload({ name: "a.pdf", size: MAX_PDF_BYTES, type: "application/pdf" }).ok, true);
  assert.equal(checkPdfUpload({ name: "a.pdf", size: MAX_PDF_BYTES + 1, type: "application/pdf" }).ok, false);
});

test("title is taken from the base file name and bounded", () => {
  assert.equal(documentTitleFromFileName("  C:\\Users\\me\\CSC101.pdf "), "CSC101.pdf");
  assert.equal(documentTitleFromFileName("/tmp/x/notes.pdf"), "notes.pdf");
  assert.equal(documentTitleFromFileName("   "), "Past-question PDF");
  assert.equal(documentTitleFromFileName("a".repeat(300)).length, 200);
});

test("the upload payload carries only the file and title, never a status", () => {
  const file = new File(["%PDF-1.4 test"], "CSC101.pdf", { type: "application/pdf" });
  const form = buildDocumentUploadForm(file, "CSC101.pdf");
  const keys = [...form.keys()].sort();
  assert.deepEqual(keys, ["file", "title"]);
  assert.equal(form.has("status"), false, "backend DTO would reject an ACTIVE status");
  assert.equal(form.get("title"), "CSC101.pdf");
  assert.equal((form.get("file") as File).name, "CSC101.pdf");
});
