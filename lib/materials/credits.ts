import { expiryOf, monthEnd } from "./expiry";
import { CREDIT_PARTS, type CreditPart } from "./parts";

/**
 * The material credit maths (D13, D14, D30, D32–D34), as pure functions over
 * a snapshot of the project's products, so they are tested without a
 * database. Everything is "to date": as it stood at the end of the month.
 *
 * Per product chain (Rev 00, Rev 01 …) the revision that counts in a month is
 * the latest one reviewed by the month's end; before any review the product
 * is under review. A product:
 *  - is IN SCOPE of a part when that revision is ticked for it (and is
 *    interior, for an interior-only part) and is not rejected (D: the
 *    material will not be used);
 *  - is COMPLIANT when, on top, its status is A or B, every row linked to the
 *    part's credit is answered Yes or N/A with at least one Yes, and every
 *    document on those rows is still inside the expiry window (D32);
 *  - is PENDING when under review or at C: it may still count (D34).
 * Forecast uses BOQ quantities; actual uses deliveries up to the month's end.
 * Count-based parts (every product must pass) have no actual.
 */

export interface SnapshotAnswer {
  creditCode: string | null;
  /** Linked to the project's credit (an unlinked code never counts). */
  linked: boolean;
  answer: string | null;
  text: string;
  docs: { issuedOn: string | null }[];
}

export interface SnapshotRevision {
  id: string;
  revision: number;
  status: string | null;
  reviewedOn: string | null;
  /** YYYY-MM-DD the revision was entered: before it, it doesn't exist. */
  createdOn: string;
  interior: boolean;
  parts: string[];
  boq: { weightT: number | null; volumeM3: number | null; costSar: number | null };
  answers: SnapshotAnswer[];
}

export interface SnapshotProduct {
  /** The chain's first revision id: the product's stable identity. */
  key: string;
  name: string;
  submittalRef: string;
  /** Oldest first. */
  revisions: SnapshotRevision[];
  /** Deliveries of the chain (as logged on its latest revision). */
  deliveries: { deliveredOn: string; weightT: number | null; volumeM3: number | null; costSar: number | null }[];
}

export interface Snapshot {
  expiryYears: number;
  boqMaterialCostSar: number | null;
  products: SnapshotProduct[];
}

export type ProductState = "compliant" | "not_compliant" | "pending";

export interface PartProduct {
  key: string;
  revisionId: string;
  revision: number;
  name: string;
  submittalRef: string;
  status: string | null;
  state: ProductState;
  /** Why it doesn't count (yet), in plain words. */
  reasons: string[];
  boqQty: number | null;
  deliveredQty: number | null;
}

export interface Share {
  num: number;
  den: number;
  /** null when there is nothing to divide by. */
  pct: number | null;
}

export interface PartResult {
  part: CreditPart;
  forecast: Share;
  /** Share of the total still pending (under review or C), forecast basis. */
  pendingPct: number | null;
  actual: Share | null;
  /** Which thresholds the forecast meets, aligned with part.thresholds. */
  met: boolean[];
  products: PartProduct[];
  /** RC-01 only: the BOQ total and how much of it the products in the app cover (D14). */
  coverage: { boqTotal: number | null; productsBoq: number; productsBoqPct: number | null; delivered: number; deliveredPct: number | null } | null;
  /** Products in scope with no quantity for this part's basis. */
  missingQuantity: number;
}

const pct = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);
const share = (num: number, den: number): Share => ({ num, den, pct: pct(num, den) });

/** The revision of a chain that counts at the end of `month`, or null if none existed yet. */
export function revisionAt(p: SnapshotProduct, month: string): SnapshotRevision | null {
  const end = monthEnd(month);
  const reviewed = p.revisions.filter((r) => r.status && r.reviewedOn && r.reviewedOn <= end);
  if (reviewed.length) return reviewed[reviewed.length - 1];
  const existing = p.revisions.filter((r) => r.createdOn <= end);
  return existing.length ? { ...existing[existing.length - 1], status: null, reviewedOn: null } : null;
}

function basisQty(basis: CreditPart["basis"], q: { weightT: number | null; volumeM3: number | null; costSar: number | null }): number | null {
  if (basis === "weight") return q.weightT;
  if (basis === "volume") return q.volumeM3;
  if (basis === "cost") return q.costSar;
  return 1;
}

/** Whether a revision meets the part's credit on its answers and documents (not its status). */
export function answersMeet(part: CreditPart, r: SnapshotRevision, expiryYears: number, end: string): string[] {
  const rows = r.answers.filter((a) => a.creditCode === part.creditCode && a.linked);
  const reasons: string[] = [];
  if (!rows.length) return [`No ${part.creditCode} rows on its questionnaire`];
  for (const a of rows) {
    const short = a.text.split("\n")[0].slice(0, 80);
    if (!a.answer) reasons.push(`Not answered: ${short}`);
    else if (a.answer === "no") reasons.push(`Answered No: ${short}`);
    if (a.answer === "yes")
      for (const d of a.docs) {
        if (!d.issuedOn) reasons.push(`Certificate without issue date: ${short}`);
        else if (expiryOf(d.issuedOn, expiryYears, end).state === "expired") reasons.push(`Certificate expired (issued ${d.issuedOn}): ${short}`);
      }
  }
  if (!reasons.length && !rows.some((a) => a.answer === "yes")) reasons.push(`No row answered Yes for ${part.creditCode}`);
  return reasons;
}

export function computePart(part: CreditPart, snap: Snapshot, month: string): PartResult {
  const end = monthEnd(month);
  const products: PartProduct[] = [];
  let missingQuantity = 0;
  for (const p of snap.products) {
    const r = revisionAt(p, month);
    if (!r || !r.parts.includes(part.key)) continue;
    if (part.interiorOnly && !r.interior) continue;
    if (r.status === "D") continue;
    const reasons: string[] = [];
    let state: ProductState;
    if (!r.status || r.status === "C") {
      state = "pending";
      reasons.push(r.status === "C" ? "Revise and resubmit (C)" : "Under review");
    } else {
      reasons.push(...answersMeet(part, r, snap.expiryYears, end));
      state = reasons.length ? "not_compliant" : "compliant";
    }
    const boqQty = basisQty(part.basis, r.boq);
    const delivered = p.deliveries.filter((d) => d.deliveredOn <= end);
    const deliveredQty =
      part.basis === "count" ? null : delivered.reduce((n, d) => n + (basisQty(part.basis, d) ?? 0), 0);
    if (boqQty == null) missingQuantity++;
    products.push({
      key: p.key,
      revisionId: r.id,
      revision: r.revision,
      name: p.name,
      submittalRef: p.submittalRef,
      status: r.status,
      state,
      reasons,
      boqQty,
      deliveredQty,
    });
  }

  const sum = (xs: PartProduct[], f: (x: PartProduct) => number | null) => xs.reduce((n, x) => n + (f(x) ?? 0), 0);
  const compliant = products.filter((x) => x.state === "compliant");
  const pending = products.filter((x) => x.state === "pending");
  const isRc = part.creditCode === "RC-01";

  const productsBoq = sum(products, (x) => x.boqQty);
  const den = isRc && snap.boqMaterialCostSar ? snap.boqMaterialCostSar : productsBoq;
  const forecast = share(sum(compliant, (x) => x.boqQty), den);
  const pendingPct = pct(sum(pending, (x) => x.boqQty), den);

  let actual: Share | null = null;
  if (part.basis !== "count") {
    const deliveredAll = sum(products, (x) => x.deliveredQty);
    const actualDen = isRc && snap.boqMaterialCostSar ? snap.boqMaterialCostSar : deliveredAll;
    actual = share(sum(compliant, (x) => x.deliveredQty), actualDen);
  }

  return {
    part,
    forecast,
    pendingPct,
    actual,
    met: part.thresholds.map((t) => forecast.pct != null && forecast.pct >= t - 1e-9),
    products,
    coverage: isRc
      ? {
          boqTotal: snap.boqMaterialCostSar,
          productsBoq,
          productsBoqPct: snap.boqMaterialCostSar ? pct(productsBoq, snap.boqMaterialCostSar) : null,
          delivered: sum(products, (x) => x.deliveredQty),
          deliveredPct: snap.boqMaterialCostSar ? pct(sum(products, (x) => x.deliveredQty), snap.boqMaterialCostSar) : null,
        }
      : null,
    missingQuantity,
  };
}

export function computeParts(snap: Snapshot, month: string, creditCode?: string): PartResult[] {
  return CREDIT_PARTS.filter((p) => !creditCode || p.creditCode === creditCode).map((p) => computePart(p, snap, month));
}

/** The month before a YYYY-MM month. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
