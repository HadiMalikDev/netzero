"use client";

import { useState, useTransition } from "react";

/**
 * A select that saves on change. Deliberately not a `<form action>`: React 19
 * resets a form's uncontrolled fields once its action completes, which snapped
 * the select back to the value it first rendered with even though the save had
 * gone through. The value is held in state and the action called directly.
 */
export function AutoSaveSelect({
  id,
  label,
  name,
  value: initial,
  options,
  fields,
  action,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  /** Extra fields posted with the value (e.g. projectId). */
  fields: Record<string, string>;
  action: (formData: FormData) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          const fd = new FormData();
          for (const [k, v] of Object.entries(fields)) fd.set(k, v);
          fd.set(name, next);
          startTransition(() => action(fd));
        }}
        className="input w-auto py-1 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {pending ? <span className="text-xs text-slate-400">Saving…</span> : null}
    </div>
  );
}
