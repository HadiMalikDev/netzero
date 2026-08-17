"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadManuals } from "./actions";
import { UploadIcon } from "@/components/icons";

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || count === 0}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Parsing & detecting…" : "Parse manual"}
    </button>
  );
}

export function BuildFromManual() {
  const [names, setNames] = useState<string[]>([]);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form ref={ref} action={uploadManuals} className="flex flex-wrap items-center gap-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        <UploadIcon width={16} height={16} />
        Select Mostadam PDF(s)
        <input
          type="file"
          name="files"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) =>
            setNames(Array.from(e.target.files ?? []).map((f) => f.name))
          }
        />
      </label>
      {names.length > 0 ? (
        <span className="text-sm text-slate-500">{names.join(", ")}</span>
      ) : null}
      <Submit count={names.length} />
      <p className="w-full text-xs text-slate-400">
        Scheme, stage, version, and issuing organization are detected from the
        document — no manual entry.
      </p>
    </form>
  );
}
