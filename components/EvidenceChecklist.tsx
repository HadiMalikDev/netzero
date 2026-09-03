"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckIcon, FileIcon, UploadIcon } from "@/components/icons";
import { formatFileSize, formatUploadedAt } from "@/lib/format";
import type { EvidenceAttachment } from "@/lib/data";

/**
 * The documents a requirement needs, and what has been provided against each.
 *
 * The manual's evidence table is already extracted per requirement and stored
 * in catalog_requirement.evidence_specs — 93 of 99 requirements in the seeded
 * Commercial D+C catalog carry one — but nothing rendered it. See
 * docs/feedback/2026-09-sprint-1/09-required-documents-checklist.
 *
 * A row is ticked when a file is attached against that document, so the tick
 * means "this document was provided", not merely "something was uploaded here".
 * Files can also be attached without claiming a document; those are listed
 * separately as supporting material.
 */

function SubmitLabel({ idle }: { idle: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center gap-1.5">
      <UploadIcon width={13} height={13} />
      {pending ? "Uploading…" : idle}
    </span>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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

/** One attached file: open it, see its size and date, remove it. */
function AttachmentRow({
  file,
  projectId,
  code,
  deleteAction,
}: {
  file: EvidenceAttachment;
  projectId: string;
  code: string;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500">
        <FileIcon width={12} height={12} />
      </span>
      <a
        href={`/api/evidence/${file.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        title={file.fileName}
      >
        {file.fileName}
      </a>
      <span className="shrink-0 text-xs text-slate-400">
        {[formatFileSize(file.fileSize), formatUploadedAt(file.createdAt)]
          .filter(Boolean)
          .join(" · ")}
      </span>
      <form action={deleteAction} className="shrink-0">
        <input type="hidden" name="docId" value={file.id} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="code" value={code} />
        <RemoveButton />
      </form>
    </li>
  );
}

/** The upload control, optionally bound to one required-document slot. */
function UploadControl({
  entryId,
  projectId,
  code,
  specIndex,
  label,
  uploadAction,
}: {
  entryId: string;
  projectId: string;
  code: string;
  specIndex: number | null;
  label: string;
  uploadAction: (formData: FormData) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={uploadAction} className="inline-flex">
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="code" value={code} />
      {specIndex != null ? (
        <input type="hidden" name="evidenceSpecIndex" value={specIndex} />
      ) : null}
      <label className="flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
        <SubmitLabel idle={label} />
        <input
          type="file"
          name="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) form.current?.requestSubmit();
          }}
        />
      </label>
    </form>
  );
}

export function EvidenceChecklist({
  specs,
  attachments,
  entryId,
  projectId,
  code,
  uploadAction,
  deleteAction,
}: {
  /** The required documents, from the manual's evidence table. */
  specs: string[];
  attachments: EvidenceAttachment[];
  entryId: string;
  projectId: string;
  code: string;
  uploadAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const bySpec = new Map<number, EvidenceAttachment[]>();
  const unassigned: EvidenceAttachment[] = [];
  for (const a of attachments) {
    // An index pointing past the end of the list (a re-parsed catalog, say)
    // is treated as unassigned rather than dropped from view.
    if (a.evidenceSpecIndex != null && a.evidenceSpecIndex < specs.length) {
      const arr = bySpec.get(a.evidenceSpecIndex) ?? [];
      arr.push(a);
      bySpec.set(a.evidenceSpecIndex, arr);
    } else {
      unassigned.push(a);
    }
  }

  const provided = specs.filter((_, i) => (bySpec.get(i)?.length ?? 0) > 0).length;

  return (
    <div className="mt-2">
      {specs.length > 0 ? (
        <div className="mb-2 overflow-hidden rounded-lg border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600">
              Required documents
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                provided === specs.length
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {provided} of {specs.length} provided
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {specs.map((spec, i) => {
              const files = bySpec.get(i) ?? [];
              const done = files.length > 0;
              return (
                <li key={i} className="px-3 py-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                      aria-hidden
                    >
                      {done ? <CheckIcon width={11} height={11} /> : null}
                    </span>
                    <span
                      className={`flex-1 text-sm ${
                        done ? "text-slate-500" : "text-slate-700"
                      }`}
                    >
                      {spec}
                    </span>
                    <span className="shrink-0">
                      <UploadControl
                        entryId={entryId}
                        projectId={projectId}
                        code={code}
                        specIndex={i}
                        label={done ? "Add" : "Attach"}
                        uploadAction={uploadAction}
                      />
                    </span>
                  </div>
                  {files.length > 0 ? (
                    <ul className="mt-1 pl-6.5">
                      {files.map((f) => (
                        <AttachmentRow
                          key={f.id}
                          file={f}
                          projectId={projectId}
                          code={code}
                          deleteAction={deleteAction}
                        />
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {unassigned.length > 0 ? (
        <div className="mb-2">
          {specs.length > 0 ? (
            <div className="mb-0.5 text-xs font-semibold text-slate-500">
              Other attachments
            </div>
          ) : null}
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
            {unassigned.map((f) => (
              <AttachmentRow
                key={f.id}
                file={f}
                projectId={projectId}
                code={code}
                deleteAction={deleteAction}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <UploadControl
        entryId={entryId}
        projectId={projectId}
        code={code}
        specIndex={null}
        label={
          specs.length > 0
            ? "Add other attachment"
            : attachments.length === 0
              ? "Attach files"
              : "Add attachment"
        }
        uploadAction={uploadAction}
      />
    </div>
  );
}
