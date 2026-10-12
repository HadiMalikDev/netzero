"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemPhoto } from "@/lib/checklists";
import { removeItemPhotoAction, uploadItemPhotoAction } from "../../../../../inspection-actions";

/**
 * The camera button on an inspection row, and the photos taken for that item
 * (2026-10-12). On a phone the picker offers the camera first; on a desktop it
 * is the file picker. A photo uploads as soon as it is chosen and the page
 * refreshes in place, so the reader keeps their scroll position and any
 * answers not yet saved. Not a form: the row already sits inside the review's
 * form, and forms cannot nest, so it calls the server action directly.
 */

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function ItemPhotos({
  projectId,
  code,
  inspectionId,
  responseId,
  itemNo,
  photos,
}: {
  projectId: string;
  code: string;
  inspectionId: string;
  responseId: string;
  itemNo: string;
  photos: ItemPhoto[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ids = () => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("code", code);
    fd.set("inspectionId", inspectionId);
    fd.set("responseId", responseId);
    return fd;
  };

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const fd = ids();
    for (const f of Array.from(files)) fd.append("photos", f);
    setError(null);
    start(async () => {
      const res = await uploadItemPhotoAction(fd);
      if (!res.ok) setError(res.error ?? "Upload failed");
      if (input.current) input.current.value = "";
      router.refresh();
    });
  };

  const remove = (docId: string) => {
    if (!confirm("Remove this photo? The file is deleted.")) return;
    const fd = ids();
    fd.set("docId", docId);
    setError(null);
    start(async () => {
      const res = await removeItemPhotoAction(fd);
      if (!res.ok) setError(res.error ?? "Could not remove");
      router.refresh();
    });
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        aria-label={`Add a photo for item ${itemNo}`}
        title="Take or add a photo for this item"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        <CameraIcon />
        {pending ? "Uploading…" : photos.length ? `Photo (${photos.length})` : "Photo"}
      </button>
      {/* No `form` owner: name-less, so the review form never submits it. */}
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      {error ? <p className="mt-1 text-xs text-amber-700">{error}</p> : null}
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
                aria-label={`Remove photo ${p.fileName}`}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[10px] leading-none text-white hover:bg-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
