"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import type { TierThreshold } from "@/lib/tiers";

function Pending() {
  const { pending } = useFormStatus();
  return pending ? <span className="text-xs text-slate-400">Saving…</span> : null;
}

/** Pick the rating level a project is pursuing; saves on change. */
export function TargetTierForm({
  projectId,
  thresholds,
  current,
  action,
}: {
  projectId: string;
  thresholds: TierThreshold[];
  current: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <label htmlFor="targetTier" className="text-xs font-medium text-slate-500">
        Target level
      </label>
      <select
        id="targetTier"
        name="targetTier"
        defaultValue={current ?? ""}
        onChange={() => form.current?.requestSubmit()}
        className="input w-auto py-1 text-sm"
      >
        <option value="">Not set</option>
        {thresholds.map((t) => (
          <option key={t.tier} value={t.tier}>
            {t.tier} · {t.min}+ pts
          </option>
        ))}
      </select>
      <Pending />
    </form>
  );
}
