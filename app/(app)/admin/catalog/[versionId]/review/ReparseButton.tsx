"use client";

import { reparseDocument } from "../../actions";

export function ReparseButton({
  documentId,
  versionId,
}: {
  documentId: string;
  versionId: string;
}) {
  return (
    <form
      action={reparseDocument}
      onSubmit={(e) => {
        if (
          !confirm(
            "Re-parse this manual? Unpromoted draft edits and AI proposals will be replaced by a fresh deterministic extract.",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="versionId" value={versionId} />
      <button
        type="submit"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Re-parse
      </button>
    </form>
  );
}
