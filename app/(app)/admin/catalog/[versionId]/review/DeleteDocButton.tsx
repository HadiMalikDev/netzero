"use client";

import { deleteSourceDocument } from "../../actions";

export function DeleteDocButton({
  documentId,
  fileName,
}: {
  documentId: string;
  fileName: string;
}) {
  return (
    <form
      action={deleteSourceDocument}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete "${fileName}" and all its parsed drafts? You'll be able to re-upload the PDF and retry.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <button
        type="submit"
        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        title="Delete this document and its drafts so you can re-upload the PDF"
      >
        Delete &amp; retry
      </button>
    </form>
  );
}
