import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocs, materialAnswers, materialDocs, materialProductTypes, type MaterialSubmittal } from "@/db/schema";
import { computeParts, previousMonth, type PartResult } from "./credits";
import { expiryOf, monthEnd, todayIso } from "./expiry";
import { existsFrom, projectProducts, type ProductSummary } from "./products";
import { loadSnapshot } from "./progress";
import { ensureProjectSmq } from "./smq";

/**
 * The monthly material checklist (D3, D8, D30, D31): the products reviewed
 * in a month (by their review date, D26), the C/D ones still open from
 * earlier months, warnings, and the credit parts as they stood at the end of
 * the month. Past months read the same way, so a month never changes once a
 * later one starts — except by back-dated reviews, which land where dated.
 */

/** Days a C or D product may wait for its resubmission before it is flagged (the brief's "two weeks"). */
export const RESUBMIT_DAYS = 14;

export interface MonthProduct {
  product: ProductSummary;
  submittal: MaterialSubmittal;
}

export interface MonthFlag {
  kind: "resubmission_overdue" | "certificate_expiring" | "certificate_expired";
  productId: string;
  productName: string;
  submittalRef: string;
  detail: string;
}

export interface MonthView {
  month: string;
  /** Every revision reviewed in the month, by review date. */
  reviewed: MonthProduct[];
  counts: Record<"A" | "B" | "C" | "D", number>;
  /** C / D reviewed before the month and not yet resubmitted by its end. */
  carried: MonthProduct[];
  flags: MonthFlag[];
  parts: PartResult[];
  /** The same parts at the end of the month before, for "what this month added". */
  previous: PartResult[];
}

export interface MonthSummary {
  month: string;
  reviewed: number;
  counts: Record<"A" | "B" | "C" | "D", number>;
}

const inMonth = (date: string | null, month: string) => Boolean(date && date.slice(0, 7) === month);

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** YYYY-MM months from `first` to `last`, newest first. */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let m = last; m >= first; m = previousMonth(m)) out.push(m);
  return out;
}

function tally(rows: { status: string | null }[]) {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of rows) if (r.status && r.status in counts) counts[r.status as keyof typeof counts]++;
  return counts;
}

/**
 * For each product, the revision that replaced it, if any. A C/D revision is
 * open until a newer revision of it exists.
 */
function replacedBy(rows: MonthProduct[]) {
  const m = new Map<string, MonthProduct>();
  for (const r of rows) if (r.product.previousRevisionId) m.set(r.product.previousRevisionId, r);
  return m;
}

const createdOn = (r: MonthProduct) => existsFrom(r.product, r.submittal);

export async function monthView(projectId: string, month: string, today = todayIso()): Promise<MonthView> {
  const rows = await projectProducts(projectId);
  const end = monthEnd(month);
  // A past month is read as at its end; the current one as at today.
  const asOf = end < today ? end : today;
  const next = replacedBy(rows);

  const reviewed = rows
    .filter((r) => inMonth(r.product.reviewedOn, month))
    .sort((a, b) => (a.product.reviewedOn! < b.product.reviewedOn! ? -1 : 1));

  const openAt = (r: MonthProduct, on: string) => {
    if (!(r.product.status === "C" || r.product.status === "D") || !r.product.reviewedOn || r.product.reviewedOn > on) return false;
    const n = next.get(r.product.id);
    return !n || createdOn(n) > on;
  };
  const carried = rows.filter((r) => openAt(r, end) && r.product.reviewedOn! < `${month}-01`);

  const flags: MonthFlag[] = [];
  for (const r of rows) {
    if (!openAt(r, asOf)) continue;
    const due = addDays(r.product.reviewedOn!, RESUBMIT_DAYS);
    if (due < asOf)
      flags.push({
        kind: "resubmission_overdue",
        productId: r.product.id,
        productName: r.product.name,
        submittalRef: r.submittal.ref,
        detail: `${r.product.status} on ${r.product.reviewedOn}; no resubmission ${RESUBMIT_DAYS} days later (due ${due})`,
      });
  }

  // Certificates on the revisions that count now (the latest ones), on the rows shown.
  const template = await ensureProjectSmq(projectId);
  const years = template?.expiryYears ?? 3;
  // Products entered after the date read are not there yet.
  const latestIds = rows
    .filter((r) => r.product.latest && r.product.status !== "D" && createdOn(r) <= asOf)
    .map((r) => r.product.id);
  if (latestIds.length) {
    const [docs, types] = await Promise.all([
      db
        .select({
          productId: materialDocs.productId,
          issuedOn: evidenceDocs.issuedOn,
          fileName: evidenceDocs.fileName,
          text: materialAnswers.text,
          sectionId: materialAnswers.sectionId,
          sectionKind: materialAnswers.sectionKind,
        })
        .from(materialDocs)
        .innerJoin(evidenceDocs, eq(materialDocs.evidenceDocId, evidenceDocs.id))
        .innerJoin(materialAnswers, eq(materialDocs.answerId, materialAnswers.id))
        .where(inArray(materialDocs.productId, latestIds)),
      db.select().from(materialProductTypes).where(inArray(materialProductTypes.productId, latestIds)),
    ]);
    const shown = new Set(types.map((t) => `${t.productId}:${t.sectionId}`));
    const byId = new Map(rows.map((r) => [r.product.id, r]));
    for (const d of docs) {
      if (!d.issuedOn || !(d.sectionKind === "all_materials" || shown.has(`${d.productId}:${d.sectionId}`))) continue;
      const e = expiryOf(d.issuedOn, years, asOf);
      if (e.state === "valid") continue;
      const r = byId.get(d.productId)!;
      flags.push({
        kind: e.state === "expired" ? "certificate_expired" : "certificate_expiring",
        productId: d.productId,
        productName: r.product.name,
        submittalRef: r.submittal.ref,
        detail: `${d.fileName} (issued ${d.issuedOn}) ${e.state === "expired" ? "expired" : "expires"} ${e.expiresOn}: ${d.text.split("\n")[0].slice(0, 70)}`,
      });
    }
  }

  const snap = await loadSnapshot(projectId);
  return {
    month,
    reviewed,
    counts: tally(reviewed.map((r) => r.product)),
    carried,
    flags,
    parts: computeParts(snap, month),
    previous: computeParts(snap, previousMonth(month)),
  };
}

/** Every month with material activity, from the first submittal or review to the current month, newest first. */
export async function monthSummaries(projectId: string, today = todayIso()): Promise<MonthSummary[]> {
  const rows = await projectProducts(projectId);
  const current = today.slice(0, 7);
  const starts = rows.flatMap((r) => [r.product.reviewedOn, r.submittal.submittedOn, createdOn(r)]).filter((d): d is string => Boolean(d));
  if (!starts.length) return [];
  const first = starts.sort()[0].slice(0, 7);
  return monthsBetween(first < current ? first : current, current).map((month) => {
    const reviewed = rows.filter((r) => inMonth(r.product.reviewedOn, month)).map((r) => r.product);
    return { month, reviewed: reviewed.length, counts: tally(reviewed) };
  });
}

/** "October 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

