"use client";

import { useFormStatus } from "react-dom";

/** Submit button for the single per-credit checklist save form. */
export function SaveCreditButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save all"}
    </button>
  );
}
