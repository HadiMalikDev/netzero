import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import { blockingRequirements } from "@/lib/status";
import {
  buildProjectFacts,
  citationFor,
  creditMd,
  findScope,
  missingEvidenceCredits,
  remaining,
  type Citation,
  type ProjectFacts,
} from "./facts";

export interface Answer {
  answer: string;
  citations: Citation[];
  grounded: true;
  via: "llm" | "deterministic";
}

const SYSTEM = `You are NetZero's grounded assistant for a Mostadam certification project.
You answer ONLY from the JSON facts provided about THIS project's confirmed credits and requirements.
Rules you must never break:
- Never invent a credit, requirement, point value, limit, or deadline that is not in the facts.
- If the facts do not contain the answer, say so plainly.
- "Overdue"/"at risk" means incomplete or missing evidence, NOT a calendar date (there are no due dates).
- Always cite the specific credit codes you used.
- When you mention a credit or requirement, link it with markdown [label](href) using the href from the facts. Never invent a URL.
Respond ONLY as JSON: {"answer": "<concise markdown answer>", "citations": ["<CODE>", ...]}.
Use credit codes exactly as they appear in the facts (e.g. "HC-10").`;

function citationsFromCodes(facts: ProjectFacts, codes: string[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const code of codes) {
    const c = facts.credits.find((x) => x.code === code);
    if (c && !seen.has(code)) {
      seen.add(code);
      out.push(citationFor({ code: c.code, title: c.title, pageStart: c.page }));
    }
  }
  return out;
}

export async function answerQuestion(
  projectId: string,
  projectName: string,
  question: string,
): Promise<Answer> {
  const { facts } = await buildProjectFacts(projectId, projectName);

  if (facts.totals.credits === 0) {
    return {
      answer:
        "This project has no confirmed credits yet. Upload a Mostadam manual and confirm the extracted draft, then I can answer from its data.",
      citations: [],
      grounded: true,
      via: "deterministic",
    };
  }

  if (hasLLM()) {
    try {
      const res = await chatJSON<{ answer?: string; citations?: string[] }>(
        [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `FACTS:\n${JSON.stringify(facts)}\n\nQUESTION: ${question}`,
          },
        ],
        { maxTokens: 700 },
      );
      if (res.answer) {
        return {
          answer: res.answer,
          citations: citationsFromCodes(facts, res.citations ?? []),
          grounded: true,
          via: "llm",
        };
      }
    } catch {
      // fall through to deterministic
    }
  }

  return deterministicAnswer(facts, question, projectId);
}

/** Deterministic guardrail answerer — also the no-key fallback. */
export function deterministicAnswer(
  facts: ProjectFacts,
  question: string,
  projectId: string,
): Answer {
  const q = question.toLowerCase();
  const scope = findScope(facts, question);

  // Status of a specific credit or category.
  if (scope?.type === "credit") {
    const c = scope.credit;
    const open = blockingRequirements(c.requirements);
    const body =
      `${creditMd(projectId, c.code, c.title)} (${c.category}) is **${c.status.replace("_", " ")}**. ` +
      `${c.requirements.length} requirement(s); ${open.length} still open.` +
      (open.length
        ? "\n\nOpen requirements:\n" +
          open
            .map(
              (r) =>
                `- [${c.code} #${r.seq}](${r.href}) (${r.metricType}) — ${r.status.replace("_", " ")}` +
                (r.requiresEvidence && r.evidenceCount === 0
                  ? ", evidence missing"
                  : ""),
            )
            .join("\n")
        : "");
    return {
      answer: body,
      citations: [
        citationFor({ code: c.code, title: c.title, pageStart: c.page }),
      ],
      grounded: true,
      via: "deterministic",
    };
  }
  if (scope?.type === "category") {
    const inCat = facts.credits.filter((c) =>
      c.category.startsWith(scope.category.code + " "),
    );
    const done = inCat.filter((c) => c.status === "completed").length;
    return {
      answer:
        `**${scope.category.code} — ${scope.category.name}**: ${inCat.length} credits, ${done} completed, ` +
        `${inCat.length - done} open.\n\n` +
        inCat
          .map(
            (c) =>
              `- ${creditMd(projectId, c.code, c.title)} — ${c.status.replace("_", " ")}`,
          )
          .join("\n"),
      citations: inCat.map((c) =>
        citationFor({ code: c.code, title: c.title, pageStart: c.page }),
      ),
      grounded: true,
      via: "deterministic",
    };
  }

  // Missing documents / evidence.
  if (/(evidence|document|missing|attach)/.test(q)) {
    const list = missingEvidenceCredits(facts);
    if (list.length === 0)
      return {
        answer:
          "No required evidence is missing — every requirement that asks for evidence has at least one file attached.",
        citations: [],
        grounded: true,
        via: "deterministic",
      };
    return {
      answer:
        `${facts.totals.missingEvidence} requirement(s) across ${list.length} credit(s) still need evidence:\n\n` +
        list
          .map(
            (c) =>
              `- ${creditMd(projectId, c.code, c.title)}: ${c.requirements
                .map((r) => `[#${r.seq}](${r.href})`)
                .join(", ")}`,
          )
          .join("\n"),
      citations: list.map((c) =>
        citationFor({ code: c.code, title: c.title, pageStart: c.page }),
      ),
      grounded: true,
      via: "deterministic",
    };
  }

  // In progress vs not started.
  if (/(in progress|not started|started)/.test(q)) {
    const ip = facts.credits.filter((c) => c.status === "in_progress");
    const ns = facts.credits.filter((c) => c.status === "not_started");
    return {
      answer:
        `**In progress (${ip.length}):**\n` +
        (ip.map((c) => `- ${creditMd(projectId, c.code, c.title)}`).join("\n") ||
          "- none") +
        `\n\n**Not started (${ns.length}):**\n` +
        (ns.map((c) => `- ${creditMd(projectId, c.code, c.title)}`).join("\n") ||
          "- none"),
      citations: [...ip, ...ns]
        .slice(0, 12)
        .map((c) =>
          citationFor({ code: c.code, title: c.title, pageStart: c.page }),
        ),
      grounded: true,
      via: "deterministic",
    };
  }

  // Default: what's remaining / what's left.
  const open = remaining(facts);
  return {
    answer:
      `**${open.length} of ${facts.totals.credits} credits are not yet complete.** ` +
      `${facts.totals.completed} completed, ${facts.totals.in_progress} in progress, ${facts.totals.not_started} not started.\n\n` +
      "Open credits:\n" +
      open
        .slice(0, 15)
        .map(
          (c) =>
            `- ${creditMd(projectId, c.code, c.title)} — ${c.status.replace("_", " ")}`,
        )
        .join("\n") +
      (open.length > 15 ? `\n…and ${open.length - 15} more.` : ""),
    citations: open
      .slice(0, 12)
      .map((c) =>
        citationFor({ code: c.code, title: c.title, pageStart: c.page }),
      ),
    grounded: true,
    via: "deterministic",
  };
}
