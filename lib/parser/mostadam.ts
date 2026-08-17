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

  // Count credit-code headers with a known prefix.
  const codeRe = new RegExp(
    `\\b(${KNOWN_PREFIXES.join("|")})-\\d{1,2}\\b`,
    "g",
  );
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
