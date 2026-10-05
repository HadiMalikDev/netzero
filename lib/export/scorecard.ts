import ExcelJS from "exceljs";
import type { CreditView, ProjectScore } from "@/lib/data";
import type { Status } from "@/lib/status";
import { creditSpan, formatSpan, type PointsSpan } from "@/lib/tiers";

/**
 * The project scorecard as an Excel workbook (V2 feedback row 8): every credit
 * with its available points, targeted points and current status, with credits
 * not targeted labelled as such. Targeted points copy the credit's available
 * range (e.g. "5–15"), so the totals row sums ranges as min–max.
 *
 * Pure: takes the already-derived project data and returns a workbook, so the
 * route only loads and serves, and tests can read the sheet back.
 */

const STATUS_LABEL: Record<Status, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
};

export interface ScorecardInput {
  projectName: string;
  ratingSystem: string;
  /** design | construction — which listed documents count as due. */
  stage: string;
  credits: CreditView[];
  score: ProjectScore;
  generatedAt: Date;
}

export const SCORECARD_COLUMNS = [
  "Code",
  "Credit",
  "Category",
  "Keystone",
  "Available points",
  "Targeted points",
  "Earned points",
  "Status",
] as const;

/** A single value stays a number (so Excel can work with it); a range is text. */
function spanCell(s: PointsSpan): number | string {
  return s.min === s.max ? s.max : formatSpan(s);
}

export function buildScorecard(input: ScorecardInput): ExcelJS.Workbook {
  const { credits, score } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "NetZero";
  wb.created = input.generatedAt;
  const ws = wb.addWorksheet("Scorecard", {
    views: [{ state: "frozen", ySplit: 9 }],
  });
  ws.columns = [
    { width: 10 },
    { width: 44 },
    { width: 30 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
  ];

  // Header block.
  const keystonesOpen = score.keystones.total - score.keystones.complete;
  const reached = score.reached
    ? score.reached.tier
    : score.byPoints
      ? `None yet — points reach ${score.byPoints.tier}, ${keystonesOpen} keystone credit(s) open`
      : "None yet";
  const header: [string, string][] = [
    ["Project", input.projectName],
    ["Rating system", input.ratingSystem],
    ["Stage", input.stage === "construction" ? "Construction" : "Design"],
    [
      "Target level",
      score.target ? `${score.target.tier} (${score.target.min}+ points)` : "Not set",
    ],
    ["Level reached", reached],
    [
      "Points",
      `${score.earned} earned · ${formatSpan(score.targeted)} targeted · ${formatSpan(score.available)} available`,
    ],
    ["Generated", input.generatedAt.toISOString().slice(0, 16).replace("T", " ")],
  ];
  ws.addRow(["NetZero — Mostadam scorecard"]).font = { bold: true, size: 14 };
  for (const [k, v] of header) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  }
  // Row 9: column headings (the frozen pane sits under it).
  const head = ws.addRow([...SCORECARD_COLUMNS]);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  });

  // One block per category, in catalog order.
  let category = "";
  for (const c of credits) {
    if (c.categoryCode !== category) {
      category = c.categoryCode;
      const g = ws.addRow([`${c.categoryCode} · ${c.categoryName}`]);
      g.font = { bold: true };
      g.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      ws.mergeCells(g.number, 1, g.number, SCORECARD_COLUMNS.length);
    }
    const span = creditSpan(c);
    const row = ws.addRow([
      c.code,
      c.title,
      c.categoryName,
      c.isKeystone ? "Yes" : "",
      spanCell(span),
      c.targeted ? spanCell(span) : "Not targeted",
      c.pointsEarned,
      STATUS_LABEL[c.status],
    ]);
    if (!c.targeted) {
      row.font = { color: { argb: "FF94A3B8" } };
      row.getCell(6).font = { bold: true, color: { argb: "FFB45309" } };
    }
  }

  // Totals.
  const total = ws.addRow([
    "",
    "Total",
    "",
    `${score.keystones.complete} of ${score.keystones.total} complete`,
    formatSpan(score.available),
    formatSpan(score.targeted),
    score.earned,
    "",
  ]);
  total.font = { bold: true };
  total.eachCell((cell) => {
    cell.border = { top: { style: "thin" } };
  });

  return wb;
}
