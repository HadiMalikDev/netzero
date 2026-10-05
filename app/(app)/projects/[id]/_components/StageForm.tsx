"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ProjectStage } from "@/lib/evidence";

function Pending() {
  const { pending } = useFormStatus();
  return pending ? <span className="text-xs text-slate-400">Saving…</span> : null;
}

/**
 * The project's stage; saves on change. It decides which listed documents are
 * due, so changing it can move credits back to In Progress.
 */
export function StageForm({
  projectId,
  stage,
  action,
}: {
  projectId: string;
  stage: ProjectStage;
  action: (formData: FormData) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <label htmlFor="stage" className="text-xs font-medium text-slate-500">
        Stage
      </label>
      <select
        id="stage"
        name="stage"
        defaultValue={stage}
        onChange={() => form.current?.requestSubmit()}
        className="input w-auto py-1 text-sm"
      >
        <option value="design">Design</option>
        <option value="construction">Construction</option>
      </select>
      <Pending />
    </form>
  );
}
