"use client";

import { useActionState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import type { DocumentActionState } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/error-state";
import { formatDate, formatFileSize } from "@/lib/format";
import type { ProductDocumentMeta } from "@/lib/api/types";

type DocAction = (
  state: DocumentActionState,
  formData: FormData,
) => Promise<DocumentActionState>;

/**
 * Product PDF management.
 *
 * SECURITY / honesty guarantees:
 *  - The file is submitted to a Server Action, which forwards it to the backend
 *    over an authenticated request. The browser never uploads directly to
 *    storage and never receives a public/downloadable PDF URL.
 *  - Progress is the *real* in-flight request state (a spinner while pending) —
 *    there is no fabricated percentage bar.
 *  - The backend endpoint isn't implemented yet, so a real attempt currently
 *    surfaces an honest error rather than a fake success.
 */
export function DocumentManager({
  uploadAction,
  deleteAction,
  doc,
}: {
  uploadAction: DocAction;
  deleteAction: DocAction;
  doc: ProductDocumentMeta | null;
}) {
  const [uploadState, uploadForm, uploading] = useActionState<
    DocumentActionState,
    FormData
  >(uploadAction, {});
  const [deleteState, deleteForm, deleting] = useActionState<
    DocumentActionState,
    FormData
  >(deleteAction, {});

  return (
    <div className="space-y-4">
      {doc ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {doc.fileName || "PDF document"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(doc.sizeBytes)}
              {doc.pageCount ? ` · ${doc.pageCount} pages` : ""} · uploaded{" "}
              {formatDate(doc.uploadedAt)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No PDF attached to this product yet.
        </p>
      )}

      <form action={uploadForm} className="space-y-2">
        <label htmlFor="file" className="text-sm font-medium text-foreground">
          {doc ? "Replace PDF" : "Upload PDF"}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary-hover"
        />
        <p className="text-xs text-muted-foreground">
          PDF only, up to 25&nbsp;MB. The file is sent to the backend over an
          authenticated request and stored privately — no public download link
          is created.
        </p>
        {uploadState.error ? (
          <InlineError error={new Error(uploadState.error)} />
        ) : null}
        {uploadState.ok && uploadState.message ? (
          <p role="status" className="text-sm text-success">
            {uploadState.message}
          </p>
        ) : null}
        <Button
          type="submit"
          loading={uploading}
          leadingIcon={<UploadCloud className="h-4 w-4" />}
        >
          {uploading ? "Uploading…" : doc ? "Replace PDF" : "Upload PDF"}
        </Button>
      </form>

      {doc ? (
        <form
          action={deleteForm}
          onSubmit={(e) => {
            if (!window.confirm("Remove this PDF from the product?")) {
              e.preventDefault();
            }
          }}
          className="space-y-2 border-t border-border pt-3"
        >
          {deleteState.error ? (
            <InlineError error={new Error(deleteState.error)} />
          ) : null}
          <Button
            type="submit"
            variant="outline"
            loading={deleting}
            leadingIcon={<Trash2 className="h-4 w-4" />}
          >
            Remove PDF
          </Button>
        </form>
      ) : null}
    </div>
  );
}
