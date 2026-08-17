"use client";

import { useFormStatus } from "react-dom";
import { applyAllProposals } from "../../actions";

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-brand-600/40 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
    >
      {pending ? "Accepting…" : `Accept all ${count}`}
    </button>
  );
}

export function AcceptAllButton({
  versionId,
  documentId,
  count,
}: {
  versionId: string;
  documentId: string;
  count: number;
}) {
  return (
    <form
      action={applyAllProposals}
      onSubmit={(e) => {
        if (
          !confirm(
            `Apply AI changes to all ${count} credits with proposals? You can still review and promote afterwards.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="documentId" value={documentId} />
      <Submit count={count} />
    </form>
  );
}
