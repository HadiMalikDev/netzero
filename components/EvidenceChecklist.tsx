"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckIcon, FileIcon, UploadIcon } from "@/components/icons";
import { ReviewNote } from "@/components/ReviewNote";
import { formatFileSize, formatUploadedAt, requirementLabel } from "@/lib/format";
import { splitBySpec, type DocTag } from "@/lib/evidence";
import type { EvidenceAttachment, RequirementView } from "@/lib/data";

/**
 * The documents a credit needs, and what has been provided against each.
 *
 * The manual's evidence table is extracted per requirement and stored in
 * catalog_requirement.evidence_specs. Row 9 of the Sprint-1 feedback first
 * rendered it under each requirement; V2 feedback asked for it to be
 * prominent, so it is now one credit-level box at the top of the credit page,
 * grouped by requirement. See docs/feedback/2026-09-sprint-1/09-required-documents-checklist.
 *
 * A row is ticked when a file is attached against that document, so the tick
 * means "this document was provided", not merely "something was uploaded here".
 * Files can also be attached without claiming a document; those are listed
 * per requirement as other files.
 */

type Action = (formData: FormData) => Promise<void>;

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
export function AttachmentRow({
  file,
  projectId,
  code,
  deleteAction,
  rerunAction,
}: {
  file: EvidenceAttachment;
  projectId: string;
  code: string;
  deleteAction: Action;
  rerunAction: Action;
}) {
  return (
    <li className="py-1">
      <div className="flex items-center gap-2">
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
      </div>
      <ReviewNote
        review={file.review}
        docId={file.id}
        projectId={projectId}
        code={code}
        rerunAction={rerunAction}
      />
    </li>
  );
}

/**
 * The upload control. `fields` are posted as hidden inputs: the requirement
 * entry (and optionally one required-document slot) the files belong to.
 */
export function UploadControl({
  fields,
  label,
  uploadAction,
}: {
  fields: Record<string, string | number>;
  label: string;
  uploadAction: Action;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={uploadAction} className="inline-flex">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
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

const TAG: Record<DocTag, { label: string; className: string }> = {
  pursuing: { label: "Pursuing this path", className: "bg-violet-600 text-white" },
  either: { label: "Either/or option", className: "bg-violet-50 text-violet-700" },
  optional: { label: "Optional · only if pursued", className: "bg-sky-50 text-sky-700" },
};

/** An optional row that has been started is being pursued, and is counted. */
function tagLabel(tag: DocTag, counted: boolean): string {
  return tag === "optional" && counted ? "Optional · pursuing" : TAG[tag].label;
}

export interface DocSection {
  req: RequirementView;
  counted: boolean;
  tag: DocTag | null;
}

/** One requirement's documents inside the credit-level box. */
function RequirementDocs({
  section,
  projectId,
  code,
  uploadAction,
  deleteAction,
  rerunAction,
}: {
  section: DocSection;
  projectId: string;
  code: string;
  uploadAction: Action;
  deleteAction: Action;
  rerunAction: Action;
}) {
  const { req, tag, counted } = section;
  const specs = req.evidenceSpecs;
  const { bySpec, unassigned, provided } = splitBySpec(specs, req.attachments);
  const entry = { entryId: req.entryId, projectId, code };

  return (
    <li
      id={`docs-req-${req.seq}`}
      className={`scroll-mt-24 px-4 py-3 ${counted ? "" : "bg-slate-50/60"}`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <a
          href={`#req-${req.seq}`}
          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-200"
          title="Go to this requirement"
        >
          #{req.seq}
        </a>
        <span className="min-w-0 truncate text-sm font-semibold text-slate-800">
          {requirementLabel(req.title, req.text)}
        </span>
        {tag ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TAG[tag].className}`}
          >
            {tagLabel(tag, counted)}
          </span>
        ) : null}
        {specs.length > 0 ? (
          <span
            className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
              provided === specs.length
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {provided} of {specs.length}
          </span>
        ) : null}
      </div>

      {specs.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {specs.map((spec, i) => {
            const files = bySpec.get(i) ?? [];
            const done = files.length > 0;
            const stage = req.evidenceStages[i];
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
                    className={`flex-1 text-sm ${done ? "text-slate-500" : "text-slate-700"}`}
                  >
                    {spec}
                    {stage ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase text-slate-500">
                        {stage} stage
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0">
                    <UploadControl
                      fields={{ ...entry, evidenceSpecIndex: i }}
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
                        rerunAction={rerunAction}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">
          The manual lists no specific documents for this requirement. A file is
          still required to close it.
        </p>
      )}

      {unassigned.length > 0 ? (
        <div className="mt-2">
          <div className="mb-0.5 text-xs font-semibold text-slate-500">
            Other files for #{req.seq}
          </div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-3">
            {unassigned.map((f) => (
              <AttachmentRow
                key={f.id}
                file={f}
                projectId={projectId}
                code={code}
                deleteAction={deleteAction}
                rerunAction={rerunAction}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-2">
        <UploadControl
          fields={entry}
          label={specs.length > 0 ? "Add other file" : "Attach files"}
          uploadAction={uploadAction}
        />
      </div>
    </li>
  );
}

/**
 * The credit-level Required documents box: every document the manual asks for,
 * grouped by requirement, with one overall "X of N provided" count. Documents of
 * an optional row nobody has started are listed but not counted; a set-aside
 * either/or option is left out and named at the bottom.
 */
export function RequiredDocuments({
  sections,
  setAside,
  projectId,
  code,
  uploadAction,
  deleteAction,
  rerunAction,
}: {
  sections: DocSection[];
  setAside: RequirementView[];
  projectId: string;
  code: string;
  uploadAction: Action;
  deleteAction: Action;
  rerunAction: Action;
}) {
  let total = 0;
  let provided = 0;
  for (const s of sections) {
    if (!s.counted) continue;
    total += s.req.evidenceSpecs.length;
    provided += splitBySpec(s.req.evidenceSpecs, s.req.attachments).provided;
  }
  const pct = total ? Math.round((provided / total) * 100) : 0;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Required documents</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Everything the manual asks you to submit for this credit. A document is
            ticked once a file is attached against it.
          </p>
        </div>
        {total > 0 ? (
          <div className="w-48">
            <div className="mb-1 text-right text-xs font-medium text-slate-600">
              {provided} of {total} provided
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  provided === total ? "bg-emerald-500" : "bg-brand-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {sections.map((s) => (
          <RequirementDocs
            key={s.req.entryId}
            section={s}
            projectId={projectId}
            code={code}
            uploadAction={uploadAction}
            deleteAction={deleteAction}
            rerunAction={rerunAction}
          />
        ))}
      </ul>
      {setAside.length > 0 ? (
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          Not listed:{" "}
          {setAside.map((r, i) => (
            <span key={r.entryId}>
              {i ? ", " : ""}#{r.seq} {requirementLabel(r.title, r.text)}
            </span>
          ))}{" "}
          — an either/or path this project is not pursuing.
        </p>
      ) : null}
    </div>
  );
}
