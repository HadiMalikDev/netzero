"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { EvidenceReviewView } from "@/lib/data";

/**
 * The AI's read of one attachment, shown under the file.
 *
 * Deliberately advisory in tone and in fact: it is a reviewer aid, never a
 * compliance state. Credit and requirement status stay derived from the values
 * entered and the files present, so nothing here changes a score. Every claim
 * is backed by a verbatim quote from the document, or it is not shown.
 */

const VERDICT_STYLE: Record<
  string,
  { label: string; chip: string; box: string }
> = {
  met: {
    label: "Appears to meet",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    box: "border-emerald-200 bg-emerald-50/40",
  },
  partially_met: {
    label: "Partially meets",
    chip: "bg-amber-50 text-amber-700 ring-amber-600/20",
    box: "border-amber-200 bg-amber-50/40",
  },
  not_met: {
    label: "Does not meet",
    chip: "bg-red-50 text-red-700 ring-red-600/20",
    box: "border-red-200 bg-red-50/40",
  },
  unclear: {
    label: "Unclear",
    chip: "bg-slate-100 text-slate-600 ring-slate-500/20",
    box: "border-slate-200 bg-slate-50",
  },
  unreadable: {
    label: "Could not read",
    chip: "bg-slate-100 text-slate-600 ring-slate-500/20",
    box: "border-slate-200 bg-slate-50",
  },
};

function RerunButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
    >
      {pending ? "Queued…" : label}
    </button>
  );
}

export function ReviewNote({
  review,
  docId,
  projectId,
  code,
  rerunAction,
}: {
  review: EvidenceReviewView | null;
  docId: string;
  projectId: string;
  code: string;
  rerunAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!review) return null;

  const rerun = (label: string) => (
    <form action={rerunAction} className="inline-flex">
      <input type="hidden" name="docId" value={docId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="code" value={code} />
      <RerunButton label={label} />
    </form>
  );

  if (review.state === "pending") {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
        AI is reading this document… refresh to see the result.
      </div>
    );
  }

  if (review.state === "failed") {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
          Review unavailable
        </span>
        <span className="text-slate-400">{review.error}</span>
        {rerun("Try again")}
      </div>
    );
  }

  const style = VERDICT_STYLE[review.verdict ?? "unclear"] ?? VERDICT_STYLE.unclear;
  const hasDetail = review.quotes.length > 0 || review.gaps.length > 0;

  return (
    <div className={`mt-1.5 rounded-lg border px-2.5 py-2 ${style.box}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style.chip}`}
        >
          {style.label}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          AI review · advisory
        </span>
        <span className="ml-auto flex items-center gap-1">
          {hasDetail ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-500 hover:bg-white/60 hover:text-slate-700"
            >
              {open ? "Hide detail" : "Show detail"}
            </button>
          ) : null}
          {rerun("Re-run")}
        </span>
      </div>

      {review.summary ? (
        <p className="mt-1 text-sm text-slate-600">{review.summary}</p>
      ) : null}

      {open ? (
        <div className="mt-2 space-y-2">
          {review.quotes.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Quoted from the document
              </div>
              <ul className="mt-1 space-y-1">
                {review.quotes.map((q, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-slate-300 pl-2 text-xs italic text-slate-600"
                  >
                    “{q}”
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.gaps.length > 0 ? (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Not found in this document
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {review.gaps.map((g, i) => (
                  <li key={i} className="text-xs text-slate-600">
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-[10px] text-slate-400">
            A reading aid only. It does not change this credit&apos;s status or
            points — confirm against the manual before relying on it.
          </p>
        </div>
      ) : null}
    </div>
  );
}
