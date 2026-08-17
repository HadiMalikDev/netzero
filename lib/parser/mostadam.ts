/**
 * Mostadam-specific knowledge and the "is this actually a Mostadam manual?" gate.
 * Category names verified against the public Commercial D+C manual (Table 3 +
 * contents). Codes are only unique within (scheme, stage) — see spec.
 */

export const CATEGORY_NAMES: Record<string, string> = {
  SS: "Site Sustainability",
  TC: "Transportation and Connectivity",
  RC: "Region and Culture",
  E: "Energy",
  W: "Water",
  HC: "Health and Comfort",
  MW: "Materials and Waste",
  EI: "Education and Innovation",
  PMM: "Policies, Management and Maintenance",
};

export const KNOWN_PREFIXES = Object.keys(CATEGORY_NAMES);

export function categoryName(prefix: string): string {
  return CATEGORY_NAMES[prefix] ?? prefix;
}

// ============================================================
// Document-wide tables (parsed ONCE from the manual's intro).
// These govern the whole rating system and are the AUTHORITATIVE source for
// keystone status, category names, and per-scope point denominators — replacing
// per-credit heuristics and the hardcoded CATEGORY_NAMES map.
// ============================================================

const CODE_IN_LINE = /^(.*?)\b([A-Z]{1,3}-\d{1,2})\b\s+(.+)$/;

export interface KeystoneTable {
  /** Credit codes flagged mandatory by the manual's Keystone Credits table. */
  keystoneCodes: Set<string>;
  /** category prefix -> display name, as spelled in that table. */
  categoryNames: Map<string, string>;
}

/**
 * Parse the manual's "Table N Keystone Credits" (§2.5). Its rows are
 * `<Category Name> <CODE> <Credit Title>` with the category name given once and
 * codes listed beneath it, so the same table yields BOTH the authoritative
 * keystone list and the category display names. Generic across the family —
 * anchored on the table caption + `AAA-NN` codes, no fixed vocabulary.
 */
export function parseKeystoneTable(fullText: string): KeystoneTable {
  const keystoneCodes = new Set<string>();
  const categoryNames = new Map<string, string>();
  const lines = fullText.split("\n").map((l) => l.trim());

  const start = lines.findIndex((l) => /^Table\s+\d+\s+Keystone\s+Credits?$/i.test(l));
  if (start < 0) return { keystoneCodes, categoryNames };

  let buf = ""; // pending (possibly wrapped) category-name fragment
  for (let i = start + 1; i < Math.min(start + 80, lines.length); i++) {
    const t = lines[i];
    // The example credit that opens §2.6 follows the table — stop before it.
    if (/credit\s+layout/i.test(t) || /^\d+\s+Implementing\b/i.test(t)) break;
    if (!t || /^Credit\s+Category\b/i.test(t) || /^\d+$/.test(t)) continue; // header / page no.
    const m = t.match(CODE_IN_LINE);
    if (m) {
      const pre = m[1].trim();
      const code = m[2];
      const prefix = code.slice(0, code.indexOf("-"));
      const name = `${buf} ${pre}`.trim().replace(/\s+/g, " ");
      if (name && !categoryNames.has(prefix)) categoryNames.set(prefix, name);
      keystoneCodes.add(code);
      buf = "";
    } else {
      buf = buf ? `${buf} ${t}` : t; // wrapped category name (e.g. "Policies, Management and")
    }
  }
  return { keystoneCodes, categoryNames };
}

/**
 * Parse the per-scope point denominators from the "Applicability of Points"
 * table (Table 2/4): a `Total Points Available <n> <n> …` row. Columns are
 * aligned positionally to `scopeNames` (detected from the credit applicability
 * matrices, same left-to-right order). Returns null when the manual has no such
 * table (e.g. single-scope O+E) so reconciliation degrades gracefully.
 */
export function parseScopeTotals(
  fullText: string,
  scopeNames: string[],
): Record<string, number> | null {
  // Flatten so a "Total Points\nAvailable 35 130 …" wrap becomes one string, and
  // match the row directly (the caption sits in the table-of-contents too, so
  // anchoring on it would pick up dot-leaders instead of the real numbers).
  const flat = fullText.replace(/\s+/g, " ");
  const m = flat.match(/Total\s+Points\s+Available\s+((?:\d+\s+)+\d+|\d+)/i);
  if (!m) return null;
  const nums = m[1].trim().split(/\s+/).map(Number);
  if (!scopeNames.length || nums.length !== scopeNames.length) return null;
  const out: Record<string, number> = {};
  scopeNames.forEach((s, i) => (out[s] = nums[i]));
  return out;
}

export interface SchemeInfo {
  scheme: string | null; // residential | commercial | communities
  stage: string | null; // D+C | O+E
}

/** Detect scheme + stage from the manual's title/header text. */
export function detectScheme(fullText: string): SchemeInfo {
  const t = fullText.slice(0, 8000); // title + intro pages
  let scheme: string | null = null;
  if (/Commercial\s+Building/i.test(t)) scheme = "commercial";
  else if (/Residential\s+Building/i.test(t)) scheme = "residential";
  else if (/Communit/i.test(t)) scheme = "communities";

  let stage: string | null = null;
  // "(D+C)" / "Design and Construction" vs "(O+E)" / "Operation"
  if (/\bD\s*\+\s*C\b|Design\s+(?:&|and)\s+Construction/i.test(t))
    stage = "D+C";
  else if (/\bO\s*\+\s*E\b|Operation\s+(?:&|and)\s+Endorsement/i.test(t))
    stage = "O+E";

  return { scheme, stage };
}

export interface GateResult {
  ok: boolean;
  reason?: string;
  scheme: string | null;
  stage: string | null;
}

/**
 * Refuse non-Mostadam PDFs. A real Mostadam manual mentions "Mostadam", uses
 * the fixed credit layout (Keystone / Aim / Credit Requirements), and contains
 * credit-code headers with known category prefixes.
 */
export function mostadamGate(fullText: string, pages: string[]): GateResult {
  const { scheme, stage } = detectScheme(fullText);

  const mentionsMostadam = /Mostadam/i.test(fullText);
  const hasLayout =
    /\bKeystone\b/i.test(fullText) &&
    /\bAim\b/.test(fullText) &&
    /Credit\s+Requirements/i.test(fullText);

  // Count credit-code headers. Prefixes vary across the Mostadam family
  // (Residential/Commercial/Communities each use their own category codes), so
  // we accept any `AAA-NN` code — the "Mostadam" mention + fixed-layout checks
  // above are what actually gate a non-Mostadam PDF out.
  const codeRe = /\b([A-Z]{1,3})-\d{1,2}\b/g;
  const codes = new Set((fullText.match(codeRe) || []).map((c) => c));

  if (!mentionsMostadam) {
    return {
      ok: false,
      scheme,
      stage,
      reason:
        "This file does not look like a Mostadam manual (no 'Mostadam' references found).",
    };
  }
  if (!hasLayout || codes.size < 3) {
    return {
      ok: false,
      scheme,
      stage,
      reason:
        "This file mentions Mostadam but lacks the Mostadam credit layout (Keystone / Aim / Credit Requirements headers and credit-code sections). Refusing to best-effort a non-Mostadam spec.",
    };
  }

  return { ok: true, scheme, stage };
}
