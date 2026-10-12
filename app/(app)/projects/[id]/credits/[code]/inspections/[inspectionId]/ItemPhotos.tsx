"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemPhoto } from "@/lib/checklists";
import {
  removeItemPhotoAction,
  setItemPhotosAction,
  uploadItemPhotoAction,
} from "../../../../../inspection-actions";

/**
 * The camera button on an inspection row, and the photos chosen for that item
 * (2026-10-12). The button opens a picker of every photo already on the
 * credit — tap to select, Done to attach — with "Upload new" for a photo not
 * on the credit yet (on a phone the file picker offers the camera). One photo
 * can show several items. Taking a photo off an item only unlinks it: the file
 * stays on the credit. The page refreshes in place, so the reader keeps their
 * scroll position and any answers not yet saved. Not a form: the row already
 * sits inside the review's form, and forms cannot nest, so it calls the server
 * actions directly. The <dialog> is in the top layer, so the row's layout
 * cannot clip it.
 */

/** A photo the picker offers: on the credit, on the path being pursued. */
export interface CreditPhotoOption {
  id: string;
  fileName: string;
  /** Where it sits on the credit ("Additional attachment (credit level)"…). */
  attachedTo: string;
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/** The element the page scrolls in (the app's <main>, or the document). */
function scroller(from: HTMLElement | null): HTMLElement {
  for (let el = from?.parentElement; el; el = el.parentElement) {
    const y = getComputedStyle(el).overflowY;
    if ((y === "auto" || y === "scroll") && el.scrollHeight > el.clientHeight) return el;
  }
  return document.documentElement;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

export function ItemPhotos({
  projectId,
  code,
  inspectionId,
  creditPhotos,
  responseId,
  itemNo,
  photos,
}: {
  projectId: string;
  code: string;
  inspectionId: string;
  creditPhotos: CreditPhotoOption[];
  responseId: string;
  itemNo: string;
  photos: ItemPhoto[];
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // No page scrolling behind the open picker (a phone scrolls the page under
  // a swipe on the backdrop otherwise).
  useEffect(() => {
    if (!open) return;
    const el = scroller(root.current);
    const prev = el.style.overflowY;
    el.style.overflowY = "hidden";
    return () => {
      el.style.overflowY = prev;
    };
  }, [open]);

  const ids = () => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("code", code);
    fd.set("inspectionId", inspectionId);
    fd.set("responseId", responseId);
    return fd;
  };

  const show = () => {
    setSelected(new Set(photos.map((p) => p.id)));
    setError(null);
    setOpen(true);
    dialog.current?.showModal();
  };

  const close = () => dialog.current?.close(); // fires onClose, which resets `open`

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const fd = ids();
    for (const f of Array.from(files)) fd.append("photos", f);
    setError(null);
    setBusy("upload");
    start(async () => {
      const res = await uploadItemPhotoAction(fd);
      if (!res.ok) setError(res.error ?? "Upload failed");
      // Uploaded photos are already on the item: show them selected.
      else setSelected((s) => new Set([...s, ...(res.ids ?? [])]));
      if (input.current) input.current.value = "";
      setBusy(null);
      router.refresh();
    });
  };

  const done = () => {
    if (sameSet(selected, new Set(photos.map((p) => p.id)))) return close();
    const fd = ids();
    for (const id of selected) fd.append("docId", id);
    setError(null);
    setBusy("save");
    start(async () => {
      const res = await setItemPhotosAction(fd);
      setBusy(null);
      if (!res.ok) return setError(res.error ?? "Could not save");
      close();
      router.refresh();
    });
  };

  const remove = (docId: string) => {
    const fd = ids();
    fd.set("docId", docId);
    setError(null);
    start(async () => {
      const res = await removeItemPhotoAction(fd);
      if (!res.ok) setError(res.error ?? "Could not remove");
      router.refresh();
    });
  };

  const count = selected.size;

  return (
    <div ref={root} className="mt-2">
      <button
        type="button"
        onClick={show}
        disabled={pending}
        aria-label={`Photos for item ${itemNo}`}
        title="Choose or take photos for this item"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        <CameraIcon />
        {photos.length ? `Photo (${photos.length})` : "Photo"}
      </button>
      {error && !open ? <p className="mt-1 text-xs text-amber-700">{error}</p> : null}
      {photos.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              <a href={`/api/evidence/${p.id}`} target="_blank" rel="noopener noreferrer" title={p.fileName}>
                {/* eslint-disable-next-line @next/next/no-img-element -- an evidence file served by our own route */}
                <img src={`/api/evidence/${p.id}`} alt={`Photo for item ${itemNo}: ${p.fileName}`} className="h-12 w-12 rounded border border-slate-200 object-cover" />
              </a>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={pending}
                aria-label={`Take photo ${p.fileName} off item ${itemNo}`}
                title="Take off this item (the photo stays on the credit)"
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[10px] leading-none text-white hover:bg-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) close(); // a tap on the backdrop
        }}
        aria-labelledby={`photos-title-${responseId}`}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg p-0 shadow-xl outline-none backdrop:bg-slate-900/50"
      >
        {open ? (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 id={`photos-title-${responseId}`} className="text-sm font-semibold text-slate-900">
                  Photos for item {itemNo}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tap the photos on {code} that show this item, or upload a new one.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-1 rounded p-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {creditPhotos.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  No photos on this credit yet. Upload one below.
                </p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {creditPhotos.map((p) => {
                    const on = selected.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          aria-pressed={on}
                          title={`${p.fileName} — ${p.attachedTo}`}
                          className={`relative block w-full overflow-hidden rounded-md border-2 ${on ? "border-emerald-600" : "border-transparent hover:border-slate-300"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- an evidence file served by our own route */}
                          <img src={`/api/evidence/${p.id}`} alt={p.fileName} loading="lazy" className="aspect-square w-full bg-slate-100 object-cover" />
                          {on ? (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs text-white" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                          <span className="block truncate px-1 py-0.5 text-left text-[10px] text-slate-500">{p.fileName}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error ? <p className="px-4 pb-2 text-xs text-amber-700">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <CameraIcon />
                {busy === "upload" ? "Uploading…" : "Upload new"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={done}
                  disabled={pending}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {busy === "save" ? "Saving…" : count ? `Done (${count})` : "Done"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
      {/* No `name`: the review form never submits it. Outside the dialog so
          it exists before the dialog opens. */}
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
    </div>
  );
}
