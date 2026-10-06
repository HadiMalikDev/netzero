import type { CreditView } from "@/lib/data";
import type { ProjectStage } from "@/lib/evidence";
import { formatPageSpan } from "@/lib/ai/review-notes";
import { creditPhotos, type Photo } from "./checklist";
import type { InspectionTemplate } from "./inspection-template";

/**
 * The printable inspection sheet of one credit: the template's numbered items
 * with blank Yes / No / Remarks columns for the site team, the advisory
 * "in uploaded plan" read slotted in per item, and every photograph already
 * attached to the credit. Pure; the route gathers the plan text, runs the
 * read and reads image bytes.
 */

export interface CoverageEntry {
  status: "covered" | "not_found";
  /** The verbatim sentence from the plan that addresses the item, when covered. */
  quote: string | null;
}

export type CoverageOutcome =
  | { ran: true; byItem: Record<string, CoverageEntry>; sources: string[] }
  | { ran: false; reason: string };

export interface SheetItem {
  no: string;
  text: string;
  coverage: CoverageEntry | null;
}

export interface SheetSection {
  no: string;
  heading: string;
  items: SheetItem[];
}

export interface SheetModel {
  template: { id: string; title: string; confirmation: string };
  project: { name: string; ratingSystem: string; stageLabel: string };
  credit: { code: string; title: string; pageSpan: string | null };
  generatedAt: string;
  sections: SheetSection[];
  coverage: { ran: true; sources: string[]; covered: number; total: number } | { ran: false; reason: string };
  photos: Photo[];
}

export interface SheetInput {
  template: InspectionTemplate;
  credit: CreditView;
  projectName: string;
  ratingSystem: string;
  stage: ProjectStage;
  generatedAt: string;
  coverage: CoverageOutcome;
}

export function buildInspectionSheet(input: SheetInput): SheetModel {
  const { template, credit, coverage } = input;
  let covered = 0;
  let total = 0;
  const sections: SheetSection[] = template.sections.map((s) => ({
    no: s.no,
    heading: s.heading,
    items: s.items.map((it) => {
      const entry = coverage.ran ? (coverage.byItem[it.no] ?? { status: "not_found", quote: null }) : null;
      if (entry) {
        total++;
        if (entry.status === "covered") covered++;
      }
      return { no: it.no, text: it.text, coverage: entry };
    }),
  }));
  return {
    template: { id: template.id, title: template.title, confirmation: template.confirmation },
    project: {
      name: input.projectName,
      ratingSystem: input.ratingSystem,
      stageLabel: input.stage === "construction" ? "Construction" : "Design",
    },
    credit: {
      code: credit.code,
      title: credit.title,
      pageSpan: formatPageSpan(credit.pageStart, credit.pageEnd),
    },
    generatedAt: input.generatedAt,
    sections,
    coverage: coverage.ran
      ? { ran: true, sources: coverage.sources, covered, total }
      : { ran: false, reason: coverage.reason },
    photos: creditPhotos(credit),
  };
}

/**
 * The files to read the plan from: those attached against the required
 * document the template names (e.g. "IAQ Management Plan…"); failing that,
 * every file on the credit, so a plan uploaded under the wrong slot or as an
 * additional attachment is still found.
 */
export function planFileIds(credit: CreditView, planDocument: RegExp): string[] {
  const direct: string[] = [];
  const all: string[] = [];
  for (const req of credit.requirements) {
    for (const a of req.attachments) {
      all.push(a.id);
      const slot =
        a.evidenceSpecIndex != null && a.evidenceSpecIndex < req.evidenceSpecs.length
          ? req.evidenceSpecs[a.evidenceSpecIndex]
          : null;
      if (slot && planDocument.test(slot)) direct.push(a.id);
    }
  }
  for (const a of credit.additionalAttachments) all.push(a.id);
  return direct.length ? direct : all;
}
