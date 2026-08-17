import { reduceByOption } from "@/lib/option-group";
import type { Applicability, CreditReconcile, ParsedCredit } from "./types";

/**
 * Reconcile-or-fail: the parser's per-document self-check. Rather than trusting
 * the extraction, we hold it against the manual's OWN declared totals — each
 * credit's `Total N`, and Table 4's per-scope denominators. A mismatch does not
 * throw; it raises a flag the reviewer sees, so an unseen layout degrades to
 * "needs a look", never to silent garbage. This is what lets the extractor
 * generalize across the Mostadam family without overfitting: correctness is
 * validated against the document, not against one hand-tuned expectation.
 */

export type { CreditReconcile };

export interface ScopeReconcile {
  scope: string;
  ok: boolean;
  expected: number; // Table 4 denominator
  got: number; // Σ credit points applicable at this scope
  note: string;
}

export interface ReconcileReport {
  ok: boolean;
  credits: Record<string, CreditReconcile>; // by credit code
  scopes: ScopeReconcile[];
}

const num = (s: string | null): number | null => {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function requirementPoints(r: { pointsRaw: string | null }): number {
  return num(r.pointsRaw) ?? 0;
}

/**
 * Recompute a credit's points from its requirements. Consecutive rows that
 * share an `option_group` are mutually exclusive (XOR) → they contribute
 * their MAX; everything else sums. Rows with no parsed points contribute 0.
 */
export function expectedCreditPoints(credit: ParsedCredit): number {
  return reduceByOption(credit.requirements, requirementPoints);
}

/**
 * Reconcile from raw parts (a credit's Total and its requirement rows) rather
 * than a full ParsedCredit — used after the AI verify step edits requirements
 * in the DB, so the stored flag reflects the FINAL rows, not the parse-time draft.
 */
export function reconcileFromParts(
  creditPointsRaw: string | null,
  reqs: { pointsRaw: string | null; optionGroup: string | null }[],
): CreditReconcile {
  const sum = reduceByOption(reqs, requirementPoints);
  const expected = num(creditPointsRaw);
  if (expected == null)
    return { ok: true, expected: null, got: sum, note: "no credit total in manual; nothing to reconcile against" };
  const ok = expected === sum;
  return {
    ok,
    expected,
    got: sum,
    note: ok ? "" : `requirements sum to ${sum} but credit Total is ${expected}`,
  };
}

export function reconcileCredit(credit: ParsedCredit): CreditReconcile {
  return reconcileFromParts(credit.pointsRaw, credit.requirements);
}

/**
 * The denominator at a scope is, per the manual, equal for every building
 * typology (points are compensated across typologies). So we sum EACH typology
 * column independently and take the mode — a single column equals the true
 * total, and the mode shrugs off ±1 OCR noise in one or two columns (which a
 * naive max-per-credit sum would instead compound into a large over-count).
 */
function scopeColumnSums(
  credits: ParsedCredit[],
  scope: string,
): number[] {
  // Sum by column index, not typology name — names can fail to recover on
  // one credit (col1…) while neighbours have real labels; position is aligned.
  const cols = new Map<number, number>();
  for (const c of credits) {
    const row = (c.applicability as Applicability | null)?.[scope];
    if (!row) continue;
    Object.values(row).forEach((v, idx) => {
      if (typeof v === "number") cols.set(idx, (cols.get(idx) ?? 0) + v);
    });
  }
  return [...cols.values()];
}

function mode(nums: number[]): number {
  const freq = new Map<number, number>();
  let best = 0;
  let bestN = -1;
  for (const n of nums) {
    const f = (freq.get(n) ?? 0) + 1;
    freq.set(n, f);
    if (f > bestN) {
      bestN = f;
      best = n;
    }
  }
  return best;
}

export function reconcileScopes(
  credits: ParsedCredit[],
  scopeTotals: Record<string, number> | null,
): ScopeReconcile[] {
  if (!scopeTotals) return [];
  const out: ScopeReconcile[] = [];
  for (const [scope, expected] of Object.entries(scopeTotals)) {
    const got = mode(scopeColumnSums(credits, scope));
    const ok = got === expected;
    out.push({
      scope,
      expected,
      got,
      ok,
      note: ok ? "" : `applicable credit points sum to ${got}, Table 4 says ${expected}`,
    });
  }
  return out;
}

export function reconcile(
  credits: ParsedCredit[],
  scopeTotals: Record<string, number> | null,
): ReconcileReport {
  const creditFlags: Record<string, CreditReconcile> = {};
  for (const c of credits) creditFlags[c.code] = reconcileCredit(c);
  const scopes = reconcileScopes(credits, scopeTotals);
  const ok =
    Object.values(creditFlags).every((f) => f.ok) && scopes.every((s) => s.ok);
  return { ok, credits: creditFlags, scopes };
}
