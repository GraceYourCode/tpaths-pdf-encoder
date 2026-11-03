"use client";

import { useActionState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import type { DocumentActionState } from "@/app/actions/products";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/error-state";
import type { DocumentStatus, ProductDocumentMeta } from "@/lib/api/types";
import { formatDate, formatFileSize } from "@/lib/format";

type DocAction = (
  state: DocumentActionState,
  formData: FormData,
) => Promise<DocumentActionState>;

const DOCUMENT_LABEL: Record<DocumentStatus, string> = {
  processing: "Processing",
  ready: "Ready",
  disabled: "Disabled",
  deleted: "Deleted",
  failed: "Failed",
};

const DOCUMENT_TONE: Record<DocumentStatus, BadgeTone> = {
  processing: "info",
  ready: "success",
  disabled: "warning",
  deleted: "neutral",
  failed: "danger",
};

/** Students can only reach a READY document, so only READY is "live". */
export function describeDocumentAccess(status: DocumentStatus): string {
  switch (status) {
    case "ready":
      return "Students with a valid purchase can read this PDF.";
    case "processing":
      return "Still processing. Students cannot access it yet.";
    case "failed":
      return "Processing failed. Students cannot access it.";
    case "disabled":
      return "Disabled. Students cannot access this version.";
    default:
      return "Removed. Students cannot access this version.";
  }
}

/**
 * Product PDF management.
 *
 * - The file goes to a Server Action, which forwards it to the backend over an
 *   authenticated request. The browser never receives a PDF or storage URL.
 * - Progress is the real in-flight request state, not a fabricated percentage.
 * - The status shown is the backend's lifecycle state (processing / ready /
 *   failed / disabled / deleted), with its failure reason when there is one.
 */
export function DocumentManager({
  uploadAction,
  deleteAction,
  doc,
  versionCount,
}: {
  uploadAction: DocAction;
  deleteAction?: DocAction;
  doc: ProductDocumentMeta | null;
  /** Number of stored versions, including disabled ones. */
  versionCount: number;
}) {
  const [uploadState, uploadForm, uploading] = useActionState<DocumentActionState, FormData>(
    uploadAction,
    {},
  );
  const [deleteState, deleteForm, deleting] = useActionState<DocumentActionState, FormData>(
    deleteAction ?? (async (state) => state),
    {},
  );

  const canRemove = Boolean(doc && deleteAction && (doc.status === "ready" || doc.status === "processing" || doc.status === "failed"));

  return (
    <div className="space-y-4">
      {doc ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {doc.fileName || "PDF document"}
                </p>
                <Badge tone={DOCUMENT_TONE[doc.status]}>{DOCUMENT_LABEL[doc.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Version {doc.version} · {formatFileSize(doc.sizeBytes)} · uploaded{" "}
                {formatDate(doc.uploadedAt)}
              </p>
              <p className="text-xs text-muted-foreground">{describeDocumentAccess(doc.status)}</p>
              {doc.status === "failed" && doc.failureReason ? (
                <p className="text-xs text-danger" role="alert">
                  Reason: {doc.failureReason}
                </p>
              ) : null}
            </div>
          </div>
          {versionCount > 1 ? (
            <p className="text-xs text-muted-foreground">
              {versionCount} stored versions. Older versions are kept for audit.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No PDF attached to this product yet.
        </p>
      )}

      <form action={uploadForm} className="space-y-2">
        <label htmlFor="file" className="text-sm font-medium text-foreground">
          {doc ? "Upload a new version" : "Upload PDF"}
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
          authenticated request and stored privately. No public download link is
          created. Uploading a new version makes it the live document and disables
          earlier ones.
        </p>
        {uploadState.error ? <InlineError error={new Error(uploadState.error)} /> : null}
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
          {uploading ? "Uploading…" : doc ? "Upload new version" : "Upload PDF"}
        </Button>
      </form>

      {canRemove ? (
        <form
          action={deleteForm}
          onSubmit={(e) => {
            if (!window.confirm("Remove this PDF? Students will lose access to this version.")) {
              e.preventDefault();
            }
          }}
          className="space-y-2 border-t border-border pt-3"
        >
          {deleteState.error ? <InlineError error={new Error(deleteState.error)} /> : null}
          {deleteState.ok && deleteState.message ? (
            <p role="status" className="text-sm text-success">
              {deleteState.message}
            </p>
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
