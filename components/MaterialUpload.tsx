"use client";

import { useActionState, useRef, useState } from "react";

type UploadAction = (prev: string | null, formData: FormData) => Promise<string | null>;

/**
 * Attach a file to a material product (Sprint 3): to one SMQ row, where the
 * certificate's issue date is required for the expiry check (D27), or to one
 * of the product's document slots, where it is optional. One step, like the
 * credit page's uploads: fill the date, pick the file, and it is sent.
 */
export function MaterialUpload({
  action,
  fields,
  label = "Attach file",
  requireDate,
  maxDate,
}: {
  action: UploadAction;
  fields: Record<string, string>;
  label?: string;
  requireDate: boolean;
  /** Today: a certificate can't be issued later (QA finding 2). */
  maxDate?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [error, submit, pending] = useActionState(action, null);
  const shown = local ?? error;

  return (
    <form ref={form} action={submit} className="flex flex-wrap items-center gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        Issued on{requireDate ? "" : " (optional)"}
        <input
          type="date"
          name="issuedOn"
          value={date}
          max={maxDate}
          onChange={(e) => {
            setDate(e.target.value);
            setLocal(null);
          }}
          className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700"
        />
      </label>
      <label
        className={`flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 ${pending ? "opacity-60" : ""}`}
      >
        {pending ? "Uploading…" : label}
        <input
          type="file"
          name="file"
          multiple
          disabled={pending}
          className="hidden"
          onChange={(e) => {
            if (!e.target.files?.length) return;
            if (requireDate && !date) {
              setLocal("Enter the date the certificate or report was issued, then pick the file.");
              e.target.value = "";
              return;
            }
            if (maxDate && date > maxDate) {
              setLocal("The issue date can't be after today.");
              e.target.value = "";
              return;
            }
            setLocal(null);
            form.current?.requestSubmit();
          }}
        />
      </label>
      {shown ? (
        <span role="alert" className="text-xs text-red-600">
          {shown}
        </span>
      ) : null}
    </form>
  );
}
