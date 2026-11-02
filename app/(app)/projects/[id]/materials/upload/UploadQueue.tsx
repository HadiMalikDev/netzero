"use client";

import { useState, useTransition } from "react";
import { formatFileSize } from "@/lib/format";
import { secondaryButtonClass, smallPrimaryButtonClass, primaryButtonClass } from "@/components/ui";

type Kind = "datasheet" | "boq" | "smq";
type Queued = Record<Kind, File[]>;

const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: "datasheet", label: "Cut sheets / technical data sheets", hint: "One or more files" },
  { key: "boq", label: "BOQ extract", hint: "The BOQ lines for this product" },
  { key: "smq", label: "SMQ pages with their attachments", hint: "The filled questionnaire and its certificates or test reports" },
];
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc";
// The server's body limit for one submit (next.config.ts).
const LIMIT = 50 * 1024 * 1024;

const size = (q: Queued) => KINDS.reduce((n, k) => n + q[k.key].reduce((m, f) => m + f.size, 0), 0);
const empty = (): Queued => ({ datasheet: [], boq: [], smq: [] });

/**
 * Upload a material submittal one product at a time (D44): pick a product's
 * files, add it to the list, repeat, then submit the list as one submittal.
 */
export function UploadQueue({ projectId, action }: { projectId: string; action: (formData: FormData) => Promise<string | null> }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const [draft, setDraft] = useState<Queued>(empty);
  // Bumped after adding, to clear the file pickers.
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const draftFiles = KINDS.reduce((n, k) => n + draft[k.key].length, 0);
  // Files picked but not yet added go with the submit: easy to forget the last "Add".
  const all = draftFiles ? [...queue, draft] : queue;
  const total = all.reduce((n, q) => n + size(q), 0);

  function submit(form: HTMLFormElement) {
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("ref", (form.elements.namedItem("ref") as HTMLInputElement).value);
    data.set("title", (form.elements.namedItem("title") as HTMLInputElement).value);
    all.forEach((q, i) => {
      data.set(`p${i}`, "1");
      for (const k of KINDS) for (const f of q[k.key]) data.append(`p${i}_${k.key}`, f);
    });
    setError(null);
    start(async () => setError(await action(data)));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && all.length) submit(e.currentTarget);
      }}
      className="space-y-6"
    >
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Submittal reference <span className="font-normal text-slate-400">(optional)</span>
          <input name="ref" placeholder="JCD-OCN-MBL-PRO-MTS-0411" className="input mt-1" />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Title <span className="font-normal text-slate-400">(optional)</span>
          <input name="title" placeholder="All epoxy flooring systems" className="input mt-1" />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Product {queue.length + 1}</h2>
        <p className="mb-4 text-sm text-slate-500">Pick this product&apos;s files, then add it to the submittal. Add the next product the same way.</p>
        <div key={round} className="grid gap-4 md:grid-cols-3">
          {KINDS.map((k) => (
            <label key={k.key} className="text-sm font-medium text-slate-700">
              {k.label}
              <span className="block text-xs font-normal text-slate-500">{k.hint}</span>
              <input
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  setDraft((d) => ({ ...d, [k.key]: files }));
                }}
                className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={!draftFiles}
          onClick={() => {
            setQueue((q) => [...q, draft]);
            setDraft(empty());
            setRound((r) => r + 1);
          }}
          className={`mt-4 ${smallPrimaryButtonClass}`}
        >
          Add to submittal
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">
          Products in this submittal ({queue.length})
        </div>
        {queue.length ? (
          <ul className="divide-y divide-slate-100">
            {queue.map((q, i) => (
              <li key={i} className="flex flex-wrap items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium text-slate-800">Product {i + 1}</div>
                  {KINDS.filter((k) => q[k.key].length).map((k) => (
                    <div key={k.key} className="text-xs text-slate-500">
                      {k.label}: {q[k.key].map((f) => f.name).join(", ")}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-slate-500">{formatFileSize(size(q))}</span>
                <button type="button" onClick={() => setQueue((all) => all.filter((_, j) => j !== i))} className={secondaryButtonClass}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-3 text-sm text-slate-500">None yet. Add the first product above.</p>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-600/20 ring-inset">
          {error}
        </p>
      ) : null}
      {total > LIMIT ? (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-600/20 ring-inset">
          These files come to {formatFileSize(total)}, more than one upload can take (50 MB). Submit some products now and the rest as a second submittal.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={!all.length || pending || total > LIMIT} className={`${primaryButtonClass} disabled:opacity-50`}>
          {pending ? "Uploading…" : all.length > 1 ? `Submit ${all.length} products` : "Submit 1 product"}
        </button>
        {all.length ? <span className="text-sm text-slate-500">{formatFileSize(total)} in all</span> : null}
      </div>
    </form>
  );
}
