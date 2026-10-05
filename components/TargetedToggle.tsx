"use client";

import { useFormStatus } from "react-dom";

function Label({ targeted, compact }: { targeted: boolean; compact: boolean }) {
  const { pending } = useFormStatus();
  if (pending) return <>Saving…</>;
  if (compact) return <>{targeted ? "Targeted" : "Not targeted"}</>;
  return <>{targeted ? "Targeted · click to drop" : "Not targeted · click to target"}</>;
}

/**
 * Switch a credit between targeted and not targeted (V2 rows 8 and 11).
 * Not-targeted credits still count what they earn, but drop out of the
 * targeted points and are labelled as such in the Excel export.
 */
export function TargetedToggle({
  projectId,
  projectCreditId,
  targeted,
  action,
  compact = false,
}: {
  projectId: string;
  projectCreditId: string;
  targeted: boolean;
  action: (formData: FormData) => Promise<void>;
  compact?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="projectCreditId" value={projectCreditId} />
      <input type="hidden" name="targeted" value={targeted ? "false" : "true"} />
      <button
        type="submit"
        aria-pressed={targeted}
        title={targeted ? "Targeted — click to mark not targeted" : "Not targeted — click to target"}
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition ${
          targeted
            ? "bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100"
            : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"
        }`}
      >
        <Label targeted={targeted} compact={compact} />
      </button>
    </form>
  );
}
