import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { checklistObservations, checklistTemplates, evidenceDocs, projectCredits } from "@/db/schema";
import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import { gatherPlanText } from "@/lib/ai/plan-coverage";
import { planFileIdsFor } from "@/lib/ai/inspection-draft";
import { WORKSPACE_ID } from "@/lib/catalog";
import { getProjectCredits } from "@/lib/data";
import { applyRecommendation } from "@/lib/observations";

/**
 * Draft a recommendation for each new observation in a corrective-action log
 * (Sprint 2 item 3). An editable draft for a person, never a decision: short,
 * practical, grounded in the observation and — when one is uploaded — the
 * project's own plan (the CEMP for ESC). It never invents standards, limits
 * or deadlines that neither text states.
 */

const SYSTEM = `You draft a corrective-action recommendation for one site observation from a construction environmental inspection, for a site manager who will edit it.

Return ONLY JSON: {"recommendation": string}

Rules:
- One or two plain sentences, at most 40 words, saying what to do to correct the observation and, if useful, how to confirm it is fixed.
- Use the project's plan text when it covers the issue, in its own terms. Never invent standards, numeric limits, deadlines, costs or regulations that neither the observation nor the plan states.
- No preamble, no markdown.`;

const MAX_PLAN = 12_000;

export function normalizeRecommendation(raw: unknown): string | null {
  const t = String((raw as { recommendation?: unknown })?.recommendation ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  const words = t.split(" ");
  return words.length > 60 ? words.slice(0, 60).join(" ") + "…" : t;
}

/** Draft recommendations for the given observations. Never throws. */
export async function draftRecommendations(observationIds: string[]): Promise<void> {
  if (!observationIds.length) return;
  if (!hasLLM()) {
    for (const id of observationIds) await applyRecommendation(id, { state: "skipped" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: checklistObservations.id,
        observation: checklistObservations.observation,
        templateId: checklistObservations.templateId,
        projectCreditId: checklistTemplates.projectCreditId,
        planDocument: checklistTemplates.planDocument,
      })
      .from(checklistObservations)
      .innerJoin(checklistTemplates, eq(checklistObservations.templateId, checklistTemplates.id))
      .where(and(inArray(checklistObservations.id, observationIds), eq(checklistObservations.workspaceId, WORKSPACE_ID)));
    if (!rows.length) return;

    // The plan text, once per credit.
    const planByCredit = new Map<string, string>();
    for (const pcId of new Set(rows.map((r) => r.projectCreditId).filter((x): x is string => Boolean(x)))) {
      const [pc] = await db.select({ projectId: projectCredits.projectId }).from(projectCredits).where(eq(projectCredits.id, pcId)).limit(1);
      const credit = pc ? (await getProjectCredits(pc.projectId)).find((c) => c.projectCreditId === pcId) : undefined;
      const planDocument = rows.find((r) => r.projectCreditId === pcId)?.planDocument ?? null;
      const ids = credit ? planFileIdsFor(credit, planDocument) : [];
      const files = ids.length
        ? await db
            .select({ filePath: evidenceDocs.filePath, fileName: evidenceDocs.fileName })
            .from(evidenceDocs)
            .where(and(inArray(evidenceDocs.id, ids), eq(evidenceDocs.workspaceId, WORKSPACE_ID)))
        : [];
      planByCredit.set(pcId, (await gatherPlanText(files)).text.slice(0, MAX_PLAN));
    }

    for (const r of rows) {
      try {
        const plan = r.projectCreditId ? planByCredit.get(r.projectCreditId) : "";
        const raw = await chatJSON<unknown>(
          [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `OBSERVATION:\n${r.observation}\n\nPROJECT PLAN TEXT:\n${plan || "(no plan uploaded)"}`,
            },
          ],
          { maxTokens: 300, signal: AbortSignal.timeout(30_000) },
        );
        const text = normalizeRecommendation(raw);
        await applyRecommendation(r.id, text ? { state: "done", text } : { state: "failed" });
      } catch {
        await applyRecommendation(r.id, { state: "failed" });
      }
    }
  } catch {
    for (const id of observationIds) await applyRecommendation(id, { state: "failed" }).catch(() => {});
  }
}
