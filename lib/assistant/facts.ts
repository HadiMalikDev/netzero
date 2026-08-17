import { getProjectCredits, type CreditView } from "@/lib/data";
import {
  hasValue,
  missingEvidenceRequirements,
  type Status,
} from "@/lib/status";

/**
 * The assistant's ONLY source of truth: structured facts derived from the
 * project's confirmed rows. Every fact carries a citation (credit code + source
 * page). The LLM phrases and ranks these; it never sources truth and must not
 * invent anything not present here.
 */

export interface Citation {
  code: string;
  title: string;
  page: number | null;
  ref: string; // human-readable, e.g. "HC-10 (p.182)"
}

export interface FactRequirement {
  seq: number;
  metricType: string;
  status: Status;
  optionGroup: string | null;
  hasValue: boolean;
  requiresEvidence: boolean;
  evidenceCount: number;
  text: string;
  page: number | null;
  href: string;
}

export interface ProjectFacts {
  projectName: string;
  totals: {
    credits: number;
    completed: number;
    in_progress: number;
    not_started: number;
    requirements: number;
    missingEvidence: number;
  };
  categories: { code: string; name: string; count: number }[];
  credits: {
    code: string;
    title: string;
    category: string;
    status: Status;
    page: number | null;
    href: string;
    requirements: FactRequirement[];
  }[];
}

export function creditHref(
  projectId: string,
  code: string,
  seq?: number,
): string {
  const base = `/projects/${projectId}/credits/${encodeURIComponent(code)}`;
  return seq != null ? `${base}#req-${seq}` : base;
}

export function creditMd(
  projectId: string,
  code: string,
  title?: string,
  seq?: number,
): string {
  const label = title ? `${code} ${title}` : seq != null ? `${code} #${seq}` : code;
  return `[${label}](${creditHref(projectId, code, seq)})`;
}

export function citationFor(c: {
  code: string;
  title: string;
  pageStart: number | null;
}): Citation {
  return {
    code: c.code,
    title: c.title,
    page: c.pageStart,
    ref: c.pageStart ? `${c.code} (p.${c.pageStart})` : c.code,
  };
}

export async function buildProjectFacts(
  projectId: string,
  projectName: string,
): Promise<{ facts: ProjectFacts; credits: CreditView[] }> {
  const credits = await getProjectCredits(projectId);

  let requirements = 0;
  let missingEvidence = 0;
  const catMap = new Map<string, { name: string; count: number }>();

  for (const c of credits) {
    const cat = catMap.get(c.categoryCode) ?? { name: c.categoryName, count: 0 };
    cat.count++;
    catMap.set(c.categoryCode, cat);
    requirements += c.requirements.length;
    missingEvidence += missingEvidenceRequirements(c.requirements).length;
  }

  const facts: ProjectFacts = {
    projectName,
    totals: {
      credits: credits.length,
      completed: credits.filter((c) => c.status === "completed").length,
      in_progress: credits.filter((c) => c.status === "in_progress").length,
      not_started: credits.filter((c) => c.status === "not_started").length,
      requirements,
      missingEvidence,
    },
    categories: [...catMap.entries()].map(([code, v]) => ({
      code,
      name: v.name,
      count: v.count,
    })),
    credits: credits.map((c) => ({
      code: c.code,
      title: c.title,
      category: `${c.categoryCode} ${c.categoryName}`,
      status: c.status,
      page: c.pageStart,
      href: creditHref(projectId, c.code),
      requirements: c.requirements.map((r) => ({
        seq: r.seq,
        metricType: r.metricType,
        status: r.status,
        optionGroup: r.optionGroup,
        hasValue: hasValue({
          metricType: r.metricType,
          requiresEvidence: r.requiresEvidence,
          valueBool: r.valueBool,
          valueNumber: r.valueNumber,
          valueText: r.valueText,
          evidenceCount: r.evidenceCount,
        }),
        requiresEvidence: r.requiresEvidence,
        evidenceCount: r.evidenceCount,
        text: r.text.slice(0, 200),
        page: r.pageStart,
        href: creditHref(projectId, c.code, r.seq),
      })),
    })),
  };

  return { facts, credits };
}

// ---------- deterministic query helpers (also used by the stub answerer) ----------

export function remaining(facts: ProjectFacts) {
  return facts.credits.filter((c) => c.status !== "completed");
}

export function missingEvidenceCredits(facts: ProjectFacts) {
  return facts.credits
    .map((c) => ({
      ...c,
      requirements: missingEvidenceRequirements(c.requirements),
    }))
    .filter((c) => c.requirements.length > 0);
}

export function findScope(facts: ProjectFacts, question: string) {
  const q = question.toUpperCase();
  const codeMatch = q.match(/\b([A-Z]{1,3}-\d{1,2})\b/);
  if (codeMatch) {
    const credit = facts.credits.find((c) => c.code === codeMatch[1]);
    if (credit) return { type: "credit" as const, credit };
  }
  const cat = facts.categories.find(
    (c) =>
      question.toLowerCase().includes(c.name.toLowerCase()) ||
      q.includes(` ${c.code} `),
  );
  if (cat) return { type: "category" as const, category: cat };
  return null;
}
