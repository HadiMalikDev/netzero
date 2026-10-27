import ExcelJS from "exceljs";
import type { MaterialAnswer, MaterialDelivery, MaterialSubmittal } from "@/db/schema";
import type { PartResult } from "@/lib/materials/credits";
import { revLabel, STATUS_LABEL, type ProductSummary, type Status } from "@/lib/materials/products";

/**
 * The Sustainability Material Tracker as an Excel workbook (Sprint 3, D22).
 * Sheet "Tracker" opens with the twelve identifying columns of the client's
 * tracker (Appendix 8 Materials Review Process, sheet TBE), one row per
 * product revision; its credit columns there are LEED and Estidama ones, so
 * the Mostadam ones follow instead: quantities, what each product counts
 * toward, and its answers per credit. "Answers" lists every SMQ answer, and
 * "Credits" the calculated parts for the month.
 *
 * Pure: the route loads, this builds, tests read it back.
 */

export const TRACKER_COLUMNS = [
  "S/N",
  "Material Submittal Reference",
  "Rev",
  "Approval Status",
  "Description",
  "Date of Submission",
  "Sustainability Applicable",
  "Discipline",
  "Supplier Name",
  "Material Delivery date",
  "Material Delivery (PO Number)",
  "Manufacturer Name",
] as const;

export interface TrackerInput {
  projectName: string;
  ratingSystem: string;
  month: string;
  generatedAt: Date;
  products: { product: ProductSummary; submittal: MaterialSubmittal }[];
  answers: MaterialAnswer[];
  docs: { answerId: string | null; fileName: string; issuedOn: string | null }[];
  deliveries: MaterialDelivery[];
  parts: PartResult[];
}

const ANSWER: Record<string, string> = { yes: "Yes", no: "No", na: "N/A" };
const STATE: Record<string, string> = { compliant: "Counts", pending: "Pending", not_compliant: "Does not count" };

function bold(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  row.alignment = { vertical: "top", wrapText: true };
}

export function buildMaterialTracker(input: TrackerInput): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NetZero";
  wb.created = input.generatedAt;

  const answersBy = new Map<string, MaterialAnswer[]>();
  for (const a of input.answers) answersBy.set(a.productId, [...(answersBy.get(a.productId) ?? []), a]);
  const deliveriesBy = new Map<string, MaterialDelivery[]>();
  for (const d of input.deliveries) deliveriesBy.set(d.productId, [...(deliveriesBy.get(d.productId) ?? []), d]);
  const docsBy = new Map<string, TrackerInput["docs"]>();
  for (const d of input.docs) if (d.answerId) docsBy.set(d.answerId, [...(docsBy.get(d.answerId) ?? []), d]);
  // Where each product's latest revision stands on each part, this month.
  const stateBy = new Map<string, string>();
  for (const r of input.parts) for (const p of r.products) stateBy.set(`${p.revisionId}:${r.part.key}`, STATE[p.state]);
  const codes = [...new Set(input.answers.filter((a) => a.projectCreditId && a.creditCode).map((a) => a.creditCode!))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  // ---------- Tracker ----------
  const ws = wb.addWorksheet("Tracker", { views: [{ state: "frozen", ySplit: 6, xSplit: 3 }] });
  ws.addRow([`Project: ${input.projectName}`]).font = { bold: true };
  ws.addRow([`Rating system: ${input.ratingSystem}`]);
  ws.addRow([`Sustainability Material Tracker · generated ${input.generatedAt.toISOString().slice(0, 10)} · credit columns as at ${input.month}`]);
  ws.addRow([]);
  const extra = [
    "Country of Origin",
    "Location of use",
    "Interior",
    "BOQ weight (t)",
    "BOQ volume (m³)",
    "BOQ cost (SAR)",
    "Delivered weight (t)",
    "Delivered volume (m³)",
    "Delivered cost (SAR)",
    ...input.parts.map((r) => `${r.part.creditCode} ${r.part.label}`),
    ...codes.map((c) => `${c} answers`),
    "Reviewed on",
    "Reviewed by",
    "Consultant remarks",
  ];
  const group = ws.addRow([...TRACKER_COLUMNS.map(() => ""), "Product", "", "", "Quantities", "", "", "", "", "", "Counts toward (latest revision)", ...input.parts.slice(1).map(() => ""), ...codes.map((_, i) => (i === 0 ? "SMQ answers by credit" : "")), "Review"]);
  bold(group);
  bold(ws.addRow([...TRACKER_COLUMNS, ...extra]));

  input.products.forEach(({ product: p, submittal: s }, i) => {
    const deliveries = (deliveriesBy.get(p.id) ?? []).sort((a, b) => (a.deliveredOn < b.deliveredOn ? -1 : 1));
    const sum = (k: "weightT" | "volumeM3" | "costSar") =>
      deliveries.some((d) => d[k] != null) ? deliveries.reduce((n, d) => n + (d[k] ?? 0), 0) : null;
    const answers = (answersBy.get(p.id) ?? []).sort((a, b) => a.sectionSeq - b.sectionSeq || a.seq - b.seq);
    const byCode = (code: string) =>
      answers
        .filter((a) => a.creditCode === code && a.projectCreditId)
        .map((a) => [ANSWER[a.answer ?? ""] ?? "-", a.value ? `${a.value}${a.unit ? ` ${a.unit}` : ""}` : ""].filter(Boolean).join(" "))
        .join("; ");
    const row = ws.addRow([
      i + 1,
      s.ref,
      revLabel(p.revision),
      p.status ? `${p.status} - ${STATUS_LABEL[p.status as Status]}` : "Under review",
      `${s.title}: ${p.name}`,
      s.submittedOn ?? "",
      p.applicable === true ? "Applicable" : p.applicable === false ? "Not applicable" : "",
      s.discipline ?? "",
      p.supplier ?? s.supplier ?? "",
      deliveries.map((d) => d.deliveredOn).join("\n"),
      deliveries.map((d) => d.poNumber ?? "").filter(Boolean).join("\n"),
      p.manufacturer ?? "",
      p.countryOfOrigin ?? "",
      p.locationOfUse ?? "",
      p.interior ? "Yes" : "No",
      p.boqWeightT,
      p.boqVolumeM3,
      p.boqCostSar,
      sum("weightT"),
      sum("volumeM3"),
      sum("costSar"),
      ...input.parts.map((r) => (p.latest ? (stateBy.get(`${p.id}:${r.part.key}`) ?? "") : "replaced")),
      ...codes.map(byCode),
      p.reviewedOn ?? "",
      p.reviewer ?? "",
      p.remarks ?? "",
    ]);
    row.alignment = { vertical: "top", wrapText: true };
  });
  ws.columns.forEach((c, i) => {
    c.width = i === 0 ? 6 : i === 4 ? 44 : i < TRACKER_COLUMNS.length ? 22 : 18;
  });

  // ---------- Answers ----------
  const as = wb.addWorksheet("Answers", { views: [{ state: "frozen", ySplit: 1 }] });
  bold(as.addRow(["Submittal", "Product", "Rev", "Status", "Section", "Mostadam credit", "LEED reference", "Required documents / parameters", "Answer", "Value", "Unit", "Project target", "Remark", "Documents (issue date)"]));
  for (const { product: p, submittal: s } of input.products) {
    for (const a of (answersBy.get(p.id) ?? []).sort((x, y) => x.sectionSeq - y.sectionSeq || x.seq - y.seq)) {
      as.addRow([
        s.ref,
        p.name,
        revLabel(p.revision),
        p.status ?? "Under review",
        a.sectionHeading,
        a.projectCreditId ? (a.creditCode ?? "") : a.creditCode ? `${a.creditCode} (unlinked)` : "",
        a.leedRef ?? "",
        a.text,
        ANSWER[a.answer ?? ""] ?? "",
        a.value ?? "",
        a.unit ?? "",
        a.targetText ?? "",
        a.remark ?? "",
        (docsBy.get(a.id) ?? []).map((d) => `${d.fileName}${d.issuedOn ? ` (${d.issuedOn})` : ""}`).join("\n"),
      ]).alignment = { vertical: "top", wrapText: true };
    }
  }
  [26, 34, 8, 12, 26, 14, 30, 60, 8, 10, 8, 24, 30, 40].forEach((w, i) => (as.getColumn(i + 1).width = w));

  // ---------- Credits ----------
  const cs = wb.addWorksheet("Credits");
  bold(cs.addRow(["Credit", "Part", "Basis", "Target (%)", "Forecast (%)", "Actual (%)", "Pending (%)", "Products counting", "Products in scope"]));
  for (const r of input.parts) {
    const round = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);
    cs.addRow([
      r.part.creditCode,
      r.part.label,
      r.part.basis,
      r.part.thresholds.join(" / "),
      round(r.forecast.pct),
      round(r.actual?.pct),
      round(r.pendingPct),
      r.products.filter((p) => p.state === "compliant").length,
      r.products.length,
    ]);
  }
  [10, 44, 10, 12, 14, 12, 12, 18, 18].forEach((w, i) => (cs.getColumn(i + 1).width = w));
  return wb;
}
