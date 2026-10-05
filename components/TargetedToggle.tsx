"use client";

import { useFormStatus } from "react-dom";
import { CheckIcon } from "@/components/icons";

/** What the state means, shown on hover/focus. */
const MEANING = {
  targeted:
    "Targeted: this project is pursuing this credit. Its points count toward the targeted total on the overview, and the Excel export lists it as targeted. Click to stop targeting it.",
  notTargeted:
    "Not targeted: set aside. Its points drop out of the targeted total and the Excel export labels it “Not targeted”. Anything it earns still counts. Click to target it again.",
};

function SubmitButton({
  code,
  targeted,
  compact,
}: {
  code: string;
  targeted: boolean;
  compact: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={targeted}
      aria-describedby={`targeted-help-${code}`}
      onClick={(e) => {
        // Dropping a credit changes the targeted total and the export, so ask
        // first. Re-targeting is harmless and goes straight through.
        if (
          targeted &&
          !confirm(
            `Stop targeting ${code}? Its points will drop out of the targeted total and the Excel export will label it "Not targeted". You can target it again at any time.`,
          )
        )
          e.preventDefault();
      }}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors disabled:opacity-60 ${
        compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"
      } ${
        targeted
          ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
          : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {targeted ? <CheckIcon width={compact ? 11 : 13} height={compact ? 11 : 13} /> : null}
      {pending ? "Saving…" : targeted ? "Targeted" : "Not targeted"}
    </button>
  );
}

/**
 * Switch a credit between targeted and not targeted (V2 rows 8 and 11).
 * Explains itself on hover; dropping a credit asks for confirmation.
 */
export function TargetedToggle({
  projectId,
  projectCreditId,
  code,
  targeted,
  action,
  compact = false,
  tooltipAbove = false,
}: {
  projectId: string;
  projectCreditId: string;
  code: string;
  targeted: boolean;
  action: (formData: FormData) => Promise<void>;
  compact?: boolean;
  /** Open the explanation upwards (rows at the bottom of the page). */
  tooltipAbove?: boolean;
}) {
  return (
    <form action={action} className="group relative inline-block">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="projectCreditId" value={projectCreditId} />
      <input type="hidden" name="targeted" value={targeted ? "false" : "true"} />
      <SubmitButton code={code} targeted={targeted} compact={compact} />
      <span
        id={`targeted-help-${code}`}
        role="tooltip"
        className={`pointer-events-none absolute right-0 z-20 hidden w-72 ${
          tooltipAbove ? "bottom-full mb-2" : "top-full mt-2"
        } rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block`}
      >
        {targeted ? MEANING.targeted : MEANING.notTargeted}
      </span>
    </form>
  );
}
