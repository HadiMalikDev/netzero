import type { CreditView, EvidenceAttachment, RequirementView } from "@/lib/data";
import type { Verdict } from "@/lib/ai/evidence-review";
import { documentSections, type DocTag, type ProjectStage } from "@/lib/evidence";
import { formatPageSpan } from "@/lib/ai/review-notes";
import { groupByOption, pathStates, type PathState } from "@/lib/option-group";
import { STATUS_LABEL, type Status } from "@/lib/status";
import { creditSpan, formatSpan } from "@/lib/tiers";
import { guidanceLists, type GuidanceList } from "./guidance-items";

/**
 * The compliance checklist of one credit, derived from what the project
 * already holds: requirement status and values, the manual's required
 * documents with the files attached against each, the AI's read of those
 * files, and the manual's own list of what the plan must contain. Nothing here
 * is entered by hand, and nothing is written back.
 *
 * Pure: takes the already-derived credit view and returns a model the PDF
 * renders. The route only loads, reads image files and serves.
 *
 * Two rules the model enforces, because this is a compliance document:
 *  - a document is Provided only when a file is attached against it;
 *  - the AI verdict is printed next to the state, never used to compute it
 *    (the same rule lib/ai/evidence-review.ts applies to status).
 */

export type DocState = "provided" | "provided_with_gaps" | "missing" | "not_due" | "not_pursued";

export const DOC_STATE_LABEL: Record<DocState, string> = {
  provided: "Provided",
  provided_with_gaps: "Provided — AI read found gaps",
  missing: "Missing",
  not_due: "Not due yet",
  /** An optional requirement nobody has started: nothing is owed yet, so nothing is "missing". */
  not_pursued: "Not pursued yet",
};

/** The screen's wording for each verdict (components/ReviewNote.tsx). */
export const VERDICT_LABEL: Record<Verdict, string> = {
  met: "Appears to meet",
  partially_met: "Partially meets",
  not_met: "Does not meet",
  unclear: "Unclear",
  unreadable: "Could not read",
};

const GAP_VERDICTS = new Set<string>(["partially_met", "not_met"]);

/** Formats @react-pdf's Image can decode. Anything else is listed, not embedded. */
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg"]);

export interface ChecklistReview {
  verdict: string | null;
  verdictLabel: string;
  summary: string | null;
  gaps: string[];
}

export interface ChecklistFile {
  id: string;
  fileName: string;
  fileSize: number | null;
  createdAt: number;
  /** PNG or JPEG: the PDF embeds it in the photographs section. */
  isImage: boolean;
  review: ChecklistReview | null;
}

export interface DocRow {
  index: number;
  text: string;
  stage: string | null;
  due: boolean;
  state: DocState;
  files: ChecklistFile[];
}

export interface RequirementBlock {
  seq: number;
  title: string | null;
  text: string;
  status: Status;
  statusLabel: string;
  /** The recorded value, worded for print ("Yes", "42 %", free text), or null. */
  value: string | null;
  note: string | null;
  tag: DocTag | null;
  /** Whether its documents count toward the credit's totals. */
  counted: boolean;
  docs: DocRow[];
  /** Files attached to the requirement without claiming a document. */
  otherFiles: ChecklistFile[];
}

export interface ChoosePath {
  options: { seq: number; title: string | null; text: string }[];
}

export interface Photo {
  fileId: string;
  fileName: string;
  createdAt: number;
  /** Where it was attached: the document it provides, or the requirement/credit. */
  attachedTo: string;
}

export interface ChecklistSummary {
  listed: number;
  due: number;
  provided: number;
  withGaps: number;
  missing: number;
}

export interface ChecklistInput {
  projectName: string;
  ratingSystem: string;
  stage: ProjectStage;
  targetTier: string | null;
  credit: CreditView;
  generatedAt: string; // pre-formatted; the model stays deterministic
}

export interface ChecklistModel {
  project: {
    name: string;
    ratingSystem: string;
    stage: ProjectStage;
    stageLabel: string;
    targetTier: string | null;
  };
  credit: {
    code: string;
    title: string;
    categoryCode: string;
    categoryName: string;
    isKeystone: boolean;
    targeted: boolean;
    status: Status;
    statusLabel: string;
    pointsEarned: number;
    pointsAvailable: string;
    pageSpan: string | null;
    aim: string | null;
  };
  generatedAt: string;
  summary: ChecklistSummary;
  /** In requirement order: a block per requirement shown, a choose step per open either/or group. */
  sections: ({ kind: "requirement"; block: RequirementBlock } | { kind: "choose"; choose: ChoosePath })[];
  /** Either/or options the project set aside. */
  setAside: { seq: number; title: string | null; text: string }[];
  photos: Photo[];
  additionalFiles: ChecklistFile[];
  guidance: GuidanceList[];
}

export function isImageFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 && IMAGE_EXT.has(fileName.slice(dot).toLowerCase());
}

function toFile(a: EvidenceAttachment): ChecklistFile {
  const r = a.review;
  // Only a finished read is reported; a pending or failed one says nothing.
  const review: ChecklistReview | null =
    r && r.state === "done"
      ? {
          verdict: r.verdict,
          verdictLabel:
            (r.verdict && VERDICT_LABEL[r.verdict as Verdict]) || VERDICT_LABEL.unclear,
          summary: r.summary,
          gaps: r.gaps,
        }
      : null;
  return {
    id: a.id,
    fileName: a.fileName,
    fileSize: a.fileSize,
    createdAt: a.createdAt,
    isImage: isImageFile(a.fileName),
    review,
  };
}

/**
 * `counted` is false for an optional requirement nobody has started: its
 * documents are listed but nothing is owed, so an absent file is "not pursued",
 * never "missing". A file attached early still reads Provided.
 */
export function docState(due: boolean, files: ChecklistFile[], counted = true): DocState {
  if (files.length === 0) {
    if (!counted) return "not_pursued";
    return due ? "missing" : "not_due";
  }
  const gaps = files.some((f) => f.review && GAP_VERDICTS.has(f.review.verdict ?? ""));
  return gaps ? "provided_with_gaps" : "provided";
}

/** The recorded value as it should print; null when nothing is recorded. */
export function formatValue(req: RequirementView): string | null {
  switch (req.metricType) {
    case "BOOLEAN":
      return req.valueBool == null ? null : req.valueBool ? "Yes" : "No";
    case "NUMERIC":
      if (req.valueNumber == null) return null;
      return req.unit ? `${req.valueNumber} ${req.unit}` : String(req.valueNumber);
    default:
      return req.valueText?.trim() ? req.valueText.trim() : null;
  }
}

function requirementBlock(
  req: RequirementView,
  tag: DocTag | null,
  counted: boolean,
): RequirementBlock {
  const files = req.attachments.map(toFile);
  const bySpec = new Map<number, ChecklistFile[]>();
  const otherFiles: ChecklistFile[] = [];
  req.attachments.forEach((a, i) => {
    if (a.evidenceSpecIndex != null && a.evidenceSpecIndex < req.evidenceSpecs.length) {
      const arr = bySpec.get(a.evidenceSpecIndex) ?? [];
      arr.push(files[i]);
      bySpec.set(a.evidenceSpecIndex, arr);
    } else {
      otherFiles.push(files[i]);
    }
  });
  const docs: DocRow[] = req.evidenceSpecs.map((text, index) => {
    const due = req.docGates[index] ?? true;
    const docFiles = bySpec.get(index) ?? [];
    return {
      index,
      text,
      stage: req.evidenceStages[index] ?? null,
      due,
      state: docState(due, docFiles, counted),
      files: docFiles,
    };
  });
  return {
    seq: req.seq,
    title: req.title,
    text: req.text,
    status: req.status,
    statusLabel: STATUS_LABEL[req.status],
    value: formatValue(req),
    note: req.note?.trim() ? req.note.trim() : null,
    tag,
    counted,
    docs,
    otherFiles,
  };
}

function label(r: Pick<RequirementView, "seq" | "title" | "text">) {
  return { seq: r.seq, title: r.title, text: r.text };
}

/**
 * Every PNG/JPEG attached anywhere on the credit, oldest first within each
 * requirement, each labelled with where it was attached. Used by the
 * inspection sheet's Description | Photos table, which lists all of them
 * (the checklist's own photo section follows the sections it shows instead).
 */
export function creditPhotos(credit: CreditView): Photo[] {
  const out: Photo[] = [];
  const add = (a: EvidenceAttachment, attachedTo: string) => {
    if (isImageFile(a.fileName))
      out.push({ fileId: a.id, fileName: a.fileName, createdAt: a.createdAt, attachedTo });
  };
  for (const req of credit.requirements) {
    for (const a of req.attachments) {
      const slot =
        a.evidenceSpecIndex != null && a.evidenceSpecIndex < req.evidenceSpecs.length
          ? req.evidenceSpecs[a.evidenceSpecIndex]
          : null;
      add(a, slot ? `Requirement #${req.seq} — ${slot}` : `Requirement #${req.seq} — other file`);
    }
  }
  for (const a of credit.additionalAttachments) add(a, "Additional attachment (credit level)");
  return out;
}

export function buildChecklist(input: ChecklistInput): ChecklistModel {
  const { credit } = input;

  // Path state of each either/or option, as the credit page computes it.
  const paths = new Map<string, PathState>();
  for (const block of groupByOption(credit.requirements)) {
    if (block.kind !== "xor") continue;
    pathStates(block.items).forEach((p, i) => paths.set(block.items[i].entryId, p));
  }
  const { sections, setAside } = documentSections(credit.requirements, paths);

  const out: ChecklistModel["sections"] = [];
  const summary: ChecklistSummary = { listed: 0, due: 0, provided: 0, withGaps: 0, missing: 0 };
  const photos: Photo[] = [];
  const photoOf = (f: ChecklistFile, attachedTo: string) =>
    photos.push({ fileId: f.id, fileName: f.fileName, createdAt: f.createdAt, attachedTo });

  for (const s of sections) {
    if (s.kind === "choose") {
      out.push({ kind: "choose", choose: { options: s.options.map(label) } });
      continue;
    }
    const block = requirementBlock(s.req, s.tag, s.counted);
    out.push({ kind: "requirement", block });
    for (const d of block.docs) {
      if (block.counted) {
        summary.listed++;
        if (d.due) summary.due++;
        if (d.state === "provided") summary.provided++;
        if (d.state === "provided_with_gaps") {
          summary.provided++;
          summary.withGaps++;
        }
        if (d.state === "missing") summary.missing++;
      }
      for (const f of d.files)
        if (f.isImage) photoOf(f, `Requirement #${block.seq} — ${d.text}`);
    }
    for (const f of block.otherFiles)
      if (f.isImage) photoOf(f, `Requirement #${block.seq} — other file`);
  }

  const additionalFiles = credit.additionalAttachments.map(toFile);
  for (const f of additionalFiles) if (f.isImage) photoOf(f, "Additional attachment (credit level)");

  const span = creditSpan(credit);
  return {
    project: {
      name: input.projectName,
      ratingSystem: input.ratingSystem,
      stage: input.stage,
      stageLabel: input.stage === "construction" ? "Construction" : "Design",
      targetTier: input.targetTier,
    },
    credit: {
      code: credit.code,
      title: credit.title,
      categoryCode: credit.categoryCode,
      categoryName: credit.categoryName,
      isKeystone: credit.isKeystone,
      targeted: credit.targeted,
      status: credit.status,
      statusLabel: STATUS_LABEL[credit.status],
      pointsEarned: credit.pointsEarned,
      pointsAvailable: formatSpan(span),
      pageSpan: formatPageSpan(credit.pageStart, credit.pageEnd),
      aim: credit.aim,
    },
    generatedAt: input.generatedAt,
    summary,
    sections: out,
    setAside: setAside.map(label),
    photos,
    additionalFiles,
    guidance: guidanceLists(credit.supportingGuidance),
  };
}
