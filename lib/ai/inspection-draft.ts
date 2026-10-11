import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocs, projectCredits } from "@/db/schema";
import { planCoverage, type CoverageEntry } from "@/lib/ai/plan-coverage";
import { applyAiDraft, getInspection, type Answer } from "@/lib/checklists";
import { WORKSPACE_ID } from "@/lib/catalog";
import { getProjectCredits, type CreditView } from "@/lib/data";

/**
 * The AI's draft answers for one inspection (Sprint 2 item 3). It reads the
 * plan uploaded against the form's plan document and, per item, suggests:
 *  - Yes, when the plan states the measure (with the sentence, verified);
 *  - N/A, only when the plan says in so many words that the item does not apply;
 *  - nothing otherwise. Never No: silence in a plan is not a failure on site.
 * A person reviews every suggestion before anything prints.
 */

/**
 * Suggestion for one item, from the verified plan read. A plan states measures,
 * so "covered" can only ever support Yes on an item where Yes is the compliant
 * answer. On a "No is compliant" item ("Is there any spill or leak at site?")
 * or a plain observation ("Any rain in the last 24 hours?") a covered reading
 * would assert a problem or a fact the plan cannot know, so it is dropped.
 * N/A stands on any item: the plan saying an item does not apply is the same
 * statement whichever way the question is phrased.
 */
export function suggestionFrom(
  entry: CoverageEntry | undefined,
  compliantAnswer: Answer | null = "yes",
): { answer: Answer | null; quote: string | null } {
  if (entry?.status === "covered" && compliantAnswer === "yes") return { answer: "yes", quote: entry.quote };
  if (entry?.status === "not_applicable") return { answer: "na", quote: entry.quote };
  return { answer: null, quote: null };
}

/**
 * The files to read the plan from: those attached against the required
 * document whose text contains `planDocument` (case aside); failing that, every
 * file on the credit, so a plan uploaded under another slot is still found.
 */
export function planFileIdsFor(credit: CreditView, planDocument: string | null): string[] {
  const needle = planDocument?.trim().toLowerCase() ?? "";
  const direct: string[] = [];
  const all: string[] = [];
  for (const req of credit.requirements) {
    for (const a of req.attachments) {
      all.push(a.id);
      const slot =
        a.evidenceSpecIndex != null && a.evidenceSpecIndex < req.evidenceSpecs.length
          ? req.evidenceSpecs[a.evidenceSpecIndex]
          : null;
      if (needle && slot && slot.toLowerCase().includes(needle)) direct.push(a.id);
    }
  }
  for (const a of credit.additionalAttachments) all.push(a.id);
  return direct.length ? direct : all;
}

/** Run the draft for an inspection and store it. Never throws. */
export async function runInspectionDraft(
  inspectionId: string,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  try {
    const insp = await getInspection(inspectionId);
    if (!insp || !insp.projectCreditId) return;

    const [pc] = await db
      .select({ projectId: projectCredits.projectId })
      .from(projectCredits)
      .where(and(eq(projectCredits.id, insp.projectCreditId), eq(projectCredits.workspaceId, WORKSPACE_ID)))
      .limit(1);
    const credit = pc
      ? (await getProjectCredits(pc.projectId)).find((c) => c.projectCreditId === insp.projectCreditId)
      : undefined;
    if (!credit) {
      await applyAiDraft(inspectionId, { state: "failed", reason: "credit not found" });
      return;
    }

    const ids = planFileIdsFor(credit, insp.template.planDocument);
    const files = ids.length
      ? await db
          .select({ filePath: evidenceDocs.filePath, fileName: evidenceDocs.fileName })
          .from(evidenceDocs)
          .where(and(inArray(evidenceDocs.id, ids), eq(evidenceDocs.workspaceId, WORKSPACE_ID)))
      : [];

    const items = insp.responses.map((r) => ({ no: r.itemNo, text: r.itemText }));
    const outcome = await planCoverage(items, files, { timeoutMs: opts.timeoutMs ?? 60_000 });
    if (!outcome.ran) {
      // "No plan yet" is an expected state, not an error.
      const skipped = /no plan uploaded|no readable text|no model configured/.test(outcome.reason);
      await applyAiDraft(inspectionId, { state: skipped ? "skipped" : "failed", reason: outcome.reason });
      return;
    }
    const byItemNo: Record<string, { answer: Answer | null; quote: string | null }> = {};
    for (const r of insp.responses) byItemNo[r.itemNo] = suggestionFrom(outcome.byItem[r.itemNo], r.compliantAnswer);
    await applyAiDraft(inspectionId, { state: "done", sources: outcome.sources, byItemNo });
  } catch (e) {
    await applyAiDraft(inspectionId, { state: "failed", reason: (e as Error).message.slice(0, 200) }).catch(() => {});
  }
}
