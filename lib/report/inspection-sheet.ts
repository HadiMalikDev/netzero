import type { CreditView } from "@/lib/data";
import type { ProjectStage } from "@/lib/evidence";
import { formatPageSpan } from "@/lib/ai/review-notes";
import type { Answer, HeaderField, InspectionDetail } from "@/lib/checklists";
import { creditPhotos, type Photo } from "./checklist";

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
    photos: creditPhotos(credit),
  };
}
