"use client";

import { useState, type ReactNode } from "react";
import { ActionForm } from "@/components/ActionForm";
import { secondaryButtonClass, smallPrimaryButtonClass } from "@/components/ui";
import type { FormAction } from "@/lib/materials/form-errors";

export function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
      <path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8l-9.3 9.3a2 2 0 0 1-.9.5l-3.4.9a.75.75 0 0 1-.9-.9l.9-3.4a2 2 0 0 1 .5-.9l9.3-9.3Z" />
    </svg>
  );
}

/**
 * Saved values shown as plain text, with an Edit button that swaps them for
 * the form's inputs and Save / Cancel. Cancel drops what was typed; a save
 * that goes through returns to the saved view. Without `view` it is an "add"
 * form: only the button shows until it is opened.
 *
 * `tools` are buttons shown beside Edit while viewing (e.g. the Active switch, ↑ ↓);
 * they submit this form with their own op and only the `hidden` fields.
 */
export function EditableSection({
  action,
  hidden,
  view,
  fields,
  title,
  tools,
  locked = false,
  editLabel = "Edit",
  saveLabel = "Save",
  startOpen = false,
  className = "",
}: {
  action: FormAction | ((formData: FormData) => Promise<void>);
  hidden: ReactNode;
  view?: ReactNode;
  fields: ReactNode;
  title?: ReactNode;
  tools?: ReactNode;
  /** An old revision: shown, never edited. */
  locked?: boolean;
  editLabel?: string;
  saveLabel?: string;
  startOpen?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(startOpen);
  // Bumped on Cancel: a fresh form, so a refused save's message goes too.
  const [round, setRound] = useState(0);
  const bar = editing ? (
    <>
      <button type="submit" name="op" value="save" className={smallPrimaryButtonClass}>
        {saveLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setRound((r) => r + 1);
        }}
        className={secondaryButtonClass}
      >
        Cancel
      </button>
    </>
  ) : (
    <>
      {tools}
      {locked ? null : (
        <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClass}>
          {view === undefined ? null : <PencilIcon />}
          {editLabel}
        </button>
      )}
    </>
  );

  return (
    <ActionForm key={round} action={action} onSaved={() => setEditing(false)} className={className} editing={editing}>
      {hidden}
      {title !== undefined || !editing ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">{title}</div>
          {editing ? null : <div className="flex flex-wrap items-center gap-2">{bar}</div>}
        </div>
      ) : null}
      {editing ? (
        <div className={`space-y-4 ${title !== undefined ? "mt-3" : ""}`}>
          {fields}
          <div className="flex flex-wrap items-center gap-2">{bar}</div>
        </div>
      ) : (
        view
      )}
    </ActionForm>
  );
}

/** One saved value: a small label over its text, or a muted "Not set". */
export function ReadField({
  label,
  children,
  className = "",
}: {
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-line text-sm ${empty ? "text-slate-400" : "text-slate-800"}`}>{empty ? "Not set" : children}</dd>
    </div>
  );
}
