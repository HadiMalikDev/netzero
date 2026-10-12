import type { CreditView } from "@/lib/data";
import type { ProjectStage } from "@/lib/evidence";
import { formatPageSpan } from "@/lib/ai/review-notes";
import { compareItemNo, type Answer, type HeaderField, type InspectionDetail } from "@/lib/checklists";
import { creditPhotos, type Photo } from "./checklist";
import type { ObservationRow } from "@/lib/observations";

/**
 * The printable copy of one reviewed inspection (Sprint 2 item 3), in the
 * site team's layout: numbered items with the reviewer's answers in the Yes /
 * No / Remarks columns. Built only from what the reviewer saved; the AI's
 * suggestions stay in the database (Hadi, 2026-10-08: final answers only).
 * Pure; the route loads the inspection and reads image bytes.
 */

export interface SheetItem {
  no: string;
  text: string;
  answer: Answer | null;
  remark: string | null;
}

export interface SheetSection {
  no: string;
  heading: string;
  items: SheetItem[];
}

export interface SheetModel {
  title: string;
  /** Empty: the form has no confirmation statement. */
  confirmation: string;
  layout: {
    naColumn: boolean;
    remarksLabel: string;
    /** The filled header, in the form's order and wording. */
    header: { label: string; value: string | null }[];
    /** One "Checked & verified by" block per position; empty = one signature line. */
    signatories: string[];
  };
  project: { name: string; ratingSystem: string; stageLabel: string };
  credit: { code: string; title: string; pageSpan: string | null };
  inspection: { date: string | null; inspector: string | null; area: string | null };
  reviewed: { by: string | null; on: string | null };
  generatedAt: string;
  sections: SheetSection[];
  photos: Photo[];
  /**
   * The corrective-action log as it stands at download (forms with the log
   * on, e.g. ESC); null prints the plain photo list instead.
   */
  observations: { title: string; rows: ObservationRow[] } | null;
}

const STAGE_LABEL: Record<string, string> = { design: "Design", construction: "Construction" };

/**
 * The stage the sheet is used in: the catalog's stage tag on the required
 * document the completed sheet becomes (e.g. "Completed IAQ Checklist…" is a
 * construction-stage document), matched as text. Falls back to the project's
 * stage when there is no such document or no tag on it.
 */
export function sheetStage(credit: CreditView, sheetDocument: string | null, projectStage: ProjectStage): string {
  const needle = sheetDocument?.trim().toLowerCase();
  if (needle) {
    for (const req of credit.requirements) {
      const i = req.evidenceSpecs.findIndex((d) => d.toLowerCase().includes(needle));
      const tag = i >= 0 ? req.evidenceStages[i] : null;
      if (tag && STAGE_LABEL[tag]) return STAGE_LABEL[tag];
    }
  }
  return STAGE_LABEL[projectStage];
}

/** "2026-10-08" → "8 Oct 2026"; anything else as given. */
export function formatInspectionDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const HEADER_LABEL: Record<HeaderField, string> = {
  ref_no: "Ref No",
  date: "Inspection date",
  time: "Time",
  inspector: "Inspected by",
  area: "Area / level",
};

export interface SheetInput {
  inspection: InspectionDetail;
  credit: CreditView;
  projectName: string;
  ratingSystem: string;
  projectStage: ProjectStage;
  generatedAt: string;
  /** The form's log, when it has one. */
  observations?: ObservationRow[];
  /**
   * Photos taken for an item from its row, by evidence id: labelled with the
   * item, and this inspection's first (see itemPhotoLabels).
   */
  photoLabels?: Map<string, { label: string; current: boolean; itemNo: string }>;
  /** Pre-formatted review date. */
  reviewedOn: string | null;
}

export function buildInspectionSheet(input: SheetInput): SheetModel {
  const { inspection: insp, credit } = input;
  const sections: SheetSection[] = [];
  for (const r of insp.responses) {
    let s = sections[sections.length - 1];
    if (s?.no !== r.sectionNo) {
      s = { no: r.sectionNo, heading: r.sectionHeading, items: [] };
      sections.push(s);
    }
    s.items.push({ no: r.itemNo, text: r.itemText, answer: r.answer, remark: r.remark });
  }
  return {
    title: insp.template.title,
    confirmation: insp.template.confirmation.trim(),
    layout: {
      naColumn: insp.template.naColumn,
      remarksLabel: insp.template.remarksLabel,
      header: insp.template.headerFields.map((f) => ({
        label: HEADER_LABEL[f],
        value: {
          ref_no: insp.refNo,
          date: formatInspectionDate(insp.inspectionDate),
          time: insp.inspectionTime,
          inspector: insp.inspector,
          area: insp.area,
        }[f],
      })),
      signatories: insp.template.signatories,
    },
    project: {
      name: input.projectName,
      ratingSystem: input.ratingSystem,
      stageLabel: sheetStage(credit, insp.template.sheetDocument, input.projectStage),
    },
    credit: { code: credit.code, title: credit.title, pageSpan: formatPageSpan(credit.pageStart, credit.pageEnd) },
    inspection: {
      date: formatInspectionDate(insp.inspectionDate),
      inspector: insp.inspector,
      area: insp.area,
    },
    reviewed: { by: insp.reviewedByName, on: input.reviewedOn },
    generatedAt: input.generatedAt,
    sections,
    photos: labelItemPhotos(creditPhotos(credit), input.photoLabels),
    observations: insp.template.observationLog
      ? { title: insp.template.observationTitle, rows: input.observations ?? [] }
      : null,
  };
}

/**
 * Item photos print under their item ("1.1 Filters at supply air intake"),
 * as the site team's own photo page does; this inspection's come first, in
 * item order, then every other photo on the credit as before.
 */
export function labelItemPhotos(
  photos: Photo[],
  labels?: Map<string, { label: string; current: boolean; itemNo: string }>,
): Photo[] {
  if (!labels?.size) return photos;
  const labelled = photos.map((p) => {
    const l = labels.get(p.fileId);
    return { p: l ? { ...p, attachedTo: l.label } : p, l };
  });
  const current = labelled
    .filter((x) => x.l?.current)
    .sort((a, b) => compareItemNo(a.l!.itemNo, b.l!.itemNo) || a.p.createdAt - b.p.createdAt);
  const rest = labelled.filter((x) => !x.l?.current);
  return [...current, ...rest].map((x) => x.p);
}
