"use client";

import { useActionState } from "react";
import { applyPartValueAction } from "../../../material-actions";

const small =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40";

/**
 * "Use forecast / Use actual" for one calculated part (D15), with what was
 * written into the requirement said beside the buttons (D41).
 */
export function ApplyPartValue({
  projectId,
  code,
  part,
  forecast,
  actual,
}: {
  projectId: string;
  code: string;
  part: string;
  forecast: boolean;
  actual: boolean;
}) {
  const [message, submit, pending] = useActionState(applyPartValueAction, null);
  return (
    <form action={submit} className="flex max-w-sm flex-col items-end gap-1.5">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="part" value={part} />
      <div className="flex gap-2">
        {forecast ? (
          <button type="submit" name="which" value="forecast" disabled={pending} className={small} title="Copy this share into the credit's requirement below">
            Use forecast
          </button>
        ) : null}
        {actual ? (
          <button type="submit" name="which" value="actual" disabled={pending} className={small} title="Copy this share into the credit's requirement below">
            Use actual
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="text-right text-xs text-slate-600">
          {message}
        </p>
      ) : null}
    </form>
  );
}
