"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { FileIcon, UploadIcon } from "@/components/icons";
import { formatFileSize, formatUploadedAt } from "@/lib/format";
import type { EvidenceAttachment } from "@/lib/data";

/**
 * The files attached to one requirement, listed under it.
 *
 * The credit screen used to print only "N attached", which read as a silent
 * failure: a user could not tell whether an upload landed, whether a second
 * file was added or had replaced the first, and had no way to open or remove
 * anything. See docs/feedback/2026-09-sprint-1 rows 2, 3, 4, 5, 10 and 13.
 */

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      // A destructive action on compliance evidence: confirm before firing.
      onClick={(e) => {
        if (!confirm("Remove this attachment? The file is deleted.")) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center gap-2 text-sm text-slate-600">
      <UploadIcon width={15} height={15} />
      {pending ? "Uploading…" : label}
    </span>
  );
}

export function AttachmentList({
  attachments,
  entryId,
  projectId,
  code,
  uploadAction,
  deleteAction,
}: {
  attachments: EvidenceAttachment[];
  entryId: string;
  projectId: string;
  code: string;
  uploadAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const uploadForm = useRef<HTMLFormElement>(null);

  return (
    <div className="mt-2">
      {attachments.length > 0 ? (
        <ul className="mb-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 bg-white px-3 py-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500">
                <FileIcon width={14} height={14} />
              </span>
              <a
                href={`/api/evidence/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
                title={a.fileName}
              >
                {a.fileName}
              </a>
              <span className="shrink-0 text-xs text-slate-400">
                {[formatFileSize(a.fileSize), formatUploadedAt(a.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <form action={deleteAction} className="shrink-0">
                <input type="hidden" name="docId" value={a.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="code" value={code} />
                <RemoveButton />
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Stays visible whether or not files are present, so "add another" is
          always an available action on an ongoing credit. */}
      <form ref={uploadForm} action={uploadAction} className="inline-flex">
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="code" value={code} />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">
          <AddButton
            label={
              attachments.length === 0 ? "Attach files" : "Add attachment"
            }
          />
          <input
            type="file"
            name="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadForm.current?.requestSubmit();
            }}
          />
        </label>
      </form>
    </div>
  );
}
