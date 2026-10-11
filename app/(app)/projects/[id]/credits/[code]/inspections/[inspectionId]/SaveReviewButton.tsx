"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * The review's Save button, with the result beside it (Hadi, 2026-10-11):
 * "Saving…" while the save runs, then "Saved at 14:32". The save refreshes
 * the page in place, so the reader stays where they are and sees the result
 * where they clicked, not in a banner at the top.
 */
export function SaveReviewButton() {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    // A save just finished: pending went true → false.
    if (wasPending.current && !pending) {
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <div className="flex items-center gap-3">
      <span role="status" aria-live="polite" className="text-sm">
        {pending ? (
          <span className="text-slate-500">Saving…</span>
        ) : savedAt ? (
          <span className="font-medium text-emerald-700">✓ Saved at {savedAt} · these are the answers the PDF prints</span>
        ) : null}
      </span>
      <Button type="submit" disabled={pending} className="disabled:opacity-60">
        {pending ? "Saving…" : "Save review"}
      </Button>
    </div>
  );
}
