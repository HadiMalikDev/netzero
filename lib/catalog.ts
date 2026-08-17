import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  parsedCredits,
  parsedRequirements,
  ratingSystems,
  rsVersions,
  sourceDocuments,
} from "@/db/schema";

export const WORKSPACE_ID = "ws_default";

// ---------- reads ----------

export async function listRatingSystems() {
  return db
    .select()
    .from(ratingSystems)
    .where(eq(ratingSystems.workspaceId, WORKSPACE_ID))
    .orderBy(ratingSystems.name);
}

export interface VersionSummary {
  version: typeof rsVersions.$inferSelect;
  ratingSystemName: string;
  creditCount: number;
}

/** All versions, each with its rating-system name and canonical credit count. */
export async function listVersions(): Promise<VersionSummary[]> {
  const rows = await db
    .select({
      version: rsVersions,
      ratingSystemName: ratingSystems.name,
    })
    .from(rsVersions)
    .innerJoin(ratingSystems, eq(rsVersions.ratingSystemId, ratingSystems.id))
    .where(eq(rsVersions.workspaceId, WORKSPACE_ID))
    .orderBy(ratingSystems.name, rsVersions.scheme, rsVersions.stage);

  const counts = await creditCountsByVersion(rows.map((r) => r.version.id));
  return rows.map((r) => ({
    version: r.version,
    ratingSystemName: r.ratingSystemName,
    creditCount: counts.get(r.version.id) ?? 0,
  }));
}

async function creditCountsByVersion(versionIds: string[]) {
  const map = new Map<string, number>();
  if (versionIds.length === 0) return map;
  const rows = await db
    .select({ id: catalogCredits.rsVersionId })
    .from(catalogCredits)
    .where(inArray(catalogCredits.rsVersionId, versionIds));
  for (const r of rows) map.set(r.id, (map.get(r.id) ?? 0) + 1);
  return map;
}

export async function listPublishedVersions(): Promise<VersionSummary[]> {
  return (await listVersions()).filter((v) => v.version.status === "published");
}

export async function getVersion(id: string) {
  const [v] = await db
    .select({
      version: rsVersions,
      ratingSystemName: ratingSystems.name,
      ratingSystemKey: ratingSystems.key,
    })
    .from(rsVersions)
    .innerJoin(ratingSystems, eq(rsVersions.ratingSystemId, ratingSystems.id))
    .where(
      and(eq(rsVersions.id, id), eq(rsVersions.workspaceId, WORKSPACE_ID)),
    );
  return v ?? null;
}

export interface CatalogCreditView {
  id: string;
  code: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  isKeystone: boolean;
  pointsRaw: string | null;
  requirementCount: number;
}

/** Canonical credits of a version, grouped by category prefix. */
export async function getVersionCredits(
  versionId: string,
): Promise<{ code: string; name: string; credits: CatalogCreditView[] }[]> {
  const credits = await db
    .select()
    .from(catalogCredits)
    .where(eq(catalogCredits.rsVersionId, versionId))
    .orderBy(catalogCredits.categoryCode, catalogCredits.code);

  const reqCounts = new Map<string, number>();
  if (credits.length) {
    const reqs = await db
      .select({ id: catalogRequirements.catalogCreditId })
      .from(catalogRequirements)
      .where(
        inArray(
          catalogRequirements.catalogCreditId,
          credits.map((c) => c.id),
        ),
      );
    for (const r of reqs) reqCounts.set(r.id, (reqCounts.get(r.id) ?? 0) + 1);
  }

  const groups = new Map<
    string,
    { name: string; credits: CatalogCreditView[] }
  >();
  for (const c of credits) {
    const g = groups.get(c.categoryCode) ?? { name: c.categoryName, credits: [] };
    g.credits.push({
      id: c.id,
      code: c.code,
      title: c.title,
      categoryCode: c.categoryCode,
      categoryName: c.categoryName,
      isKeystone: c.isKeystone,
      pointsRaw: c.pointsRaw,
      requirementCount: reqCounts.get(c.id) ?? 0,
    });
    groups.set(c.categoryCode, g);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, g]) => ({ code, name: g.name, credits: g.credits }));
}

export async function getCatalogCredit(versionId: string, code: string) {
  const [credit] = await db
    .select()
    .from(catalogCredits)
    .where(
      and(
        eq(catalogCredits.rsVersionId, versionId),
        eq(catalogCredits.code, code),
      ),
    );
  if (!credit) return null;
  const reqs = await db
    .select()
    .from(catalogRequirements)
    .where(eq(catalogRequirements.catalogCreditId, credit.id))
    .orderBy(catalogRequirements.seq);
  return { credit, requirements: reqs };
}

// ---------- parsed drafts (catalog authoring / review) ----------

export interface ParsedDraftRequirement {
  seq: number;
  title: string | null;
  text: string;
  metricType: string;
  unit: string | null;
  pointsRaw: string | null;
  hasEvidence: boolean;
  measurable: string | null; // human-readable target, if extracted
  origin: string; // deterministic | ai_added | ai_corrected
  pageStart: number | null;
}

interface NumericSpecShape {
  summary?: string;
  limits?: { name: string; op: string; value: number; unit: string }[];
  threshold?: { op: string; value: number; unit: string | null };
}

/** Render a numeric_spec JSON blob into a short measurable-target string. */
export function summarizeSpec(json: string | null): string | null {
  if (!json) return null;
  let spec: NumericSpecShape;
  try {
    spec = JSON.parse(json);
  } catch {
    return null;
  }
  // Concrete structured values first; fall back to the LLM's prose summary.
  if (spec.limits?.length) {
    const f = spec.limits[0];
    return `${spec.limits.length} limit${spec.limits.length === 1 ? "" : "s"} · e.g. ${f.name} ${f.op} ${f.value} ${f.unit}`;
  }
  if (spec.threshold)
    return `${spec.threshold.op} ${spec.threshold.value}${spec.threshold.unit ? " " + spec.threshold.unit : ""}`;
  if (spec.summary) return spec.summary;
  return null;
}

export interface ProposedRequirementView {
  seq: number;
  change: string; // unchanged | corrected | added
  title: string | null;
  text: string;
  metricType: string;
  unit: string | null;
  pointsRaw: string | null;
  measurable: string | null;
  reasoning: string;
}

export interface ParsedDraftCredit {
  id: string;
  code: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  isKeystone: boolean;
  pointsRaw: string | null;
  aim: string | null;
  pageStart: number | null;
  promoted: boolean;
  dropped: boolean;
  aiStatus: string | null; // proposed | applied | rejected
  proposal: ProposedRequirementView[] | null;
  requirements: ParsedDraftRequirement[];
}

export interface DocumentDrafts {
  document: typeof sourceDocuments.$inferSelect;
  credits: ParsedDraftCredit[];
}

/** Source documents (parse runs) of a version, with their parsed draft credits. */
export async function getVersionParsedDrafts(
  versionId: string,
): Promise<DocumentDrafts[]> {
  const docs = await db
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.rsVersionId, versionId))
    .orderBy(sourceDocuments.createdAt);

  const out: DocumentDrafts[] = [];
  for (const doc of docs) {
    const credits = await db
      .select()
      .from(parsedCredits)
      .where(eq(parsedCredits.sourceDocumentId, doc.id))
      .orderBy(parsedCredits.categoryCode, parsedCredits.code);

    const views: ParsedDraftCredit[] = [];
    for (const c of credits) {
      const reqs = await db
        .select()
        .from(parsedRequirements)
        .where(eq(parsedRequirements.parsedCreditId, c.id))
        .orderBy(parsedRequirements.seq);
      let proposal: ProposedRequirementView[] | null = null;
      if (c.aiProposal) {
        try {
          const parsed = JSON.parse(c.aiProposal) as {
            requirements?: {
              seq: number;
              change: string;
              proposed: {
                title: string | null;
                text: string;
                metricType: string;
                unit: string | null;
                pointsRaw: string | null;
                measurable: string | null;
              };
              reasoning: string;
            }[];
          };
          proposal = (parsed.requirements ?? []).map((p) => ({
            seq: p.seq,
            change: p.change,
            title: p.proposed.title ?? null,
            text: p.proposed.text,
            metricType: p.proposed.metricType,
            unit: p.proposed.unit,
            pointsRaw: p.proposed.pointsRaw,
            measurable: p.proposed.measurable,
            reasoning: p.reasoning,
          }));
        } catch {
          proposal = null;
        }
      }

      views.push({
        id: c.id,
        code: c.code,
        title: c.title,
        categoryCode: c.categoryCode,
        categoryName: c.categoryName,
        isKeystone: c.isKeystone,
        pointsRaw: c.pointsRaw,
        aim: c.aim,
        pageStart: c.pageStart,
        promoted: c.promoted,
        dropped: c.dropped,
        aiStatus: c.aiStatus,
        proposal,
        requirements: reqs.map((r) => ({
          seq: r.seq,
          title: r.title,
          text: r.text,
          metricType: r.metricType,
          unit: r.unit,
          pointsRaw: r.pointsRaw,
          hasEvidence: r.evidenceSpecs
            ? (JSON.parse(r.evidenceSpecs) as string[]).length > 0
            : false,
          measurable: summarizeSpec(r.numericSpec),
          origin: r.origin,
          pageStart: r.pageStart,
        })),
      });
    }
    out.push({ document: doc, credits: views });
  }
  return out;
}

// ---------- promote ----------

/**
 * Promote parsed drafts into the canonical catalog under an rs_version.
 * Keyed by (rs_version_id, code): re-promoting a code replaces its canonical
 * rows, never duplicates. This is the "parse once → curate → catalog" step.
 */
export async function promoteToCatalog(
  rsVersionId: string,
  parsedCreditIds: string[],
): Promise<{ promoted: number }> {
  if (parsedCreditIds.length === 0) return { promoted: 0 };

  const drafts = await db
    .select()
    .from(parsedCredits)
    .where(inArray(parsedCredits.id, parsedCreditIds));

  let promoted = 0;
  for (const d of drafts) {
    // Replace an existing canonical credit with the same (version, code).
    const [existing] = await db
      .select({ id: catalogCredits.id })
      .from(catalogCredits)
      .where(
        and(
          eq(catalogCredits.rsVersionId, rsVersionId),
          eq(catalogCredits.code, d.code),
        ),
      );
    if (existing) {
      await db
        .delete(catalogRequirements)
        .where(eq(catalogRequirements.catalogCreditId, existing.id));
      await db.delete(catalogCredits).where(eq(catalogCredits.id, existing.id));
    }

    const creditId = randomUUID();
    await db.insert(catalogCredits).values({
      id: creditId,
      workspaceId: WORKSPACE_ID,
      rsVersionId,
      code: d.code,
      title: d.title,
      categoryCode: d.categoryCode,
      categoryName: d.categoryName,
      isKeystone: d.isKeystone,
      pointsRaw: d.pointsRaw,
      aim: d.aim,
      references: d.references,
      sourcePageStart: d.pageStart,
      sourcePageEnd: d.pageEnd,
    });

    const reqs = await db
      .select()
      .from(parsedRequirements)
      .where(eq(parsedRequirements.parsedCreditId, d.id))
      .orderBy(parsedRequirements.seq);
    for (const r of reqs) {
      await db.insert(catalogRequirements).values({
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        catalogCreditId: creditId,
        seq: r.seq,
        title: r.title,
        text: r.text,
        metricType: r.metricType,
        unit: r.unit,
        pointsRaw: r.pointsRaw,
        numericSpec: r.numericSpec,
        evidenceSpecs: r.evidenceSpecs,
        sourcePageStart: r.pageStart,
        sourcePageEnd: r.pageEnd,
      });
    }

    await db
      .update(parsedCredits)
      .set({ promoted: true })
      .where(eq(parsedCredits.id, d.id));
    promoted++;
  }
  return { promoted };
}

// ---------- apply an AI proposal (pure DB reconciliation; testable) ----------

interface StoredProposal {
  requirements: {
    seq: number;
    change: string; // unchanged | corrected | added
    proposed: {
      title: string | null;
      text: string;
      metricType: string;
      unit: string | null;
      pointsRaw: string | null;
      measurable: string | null;
    };
    reasoning: string;
  }[];
}

/** Fold a measurable target into a numeric_spec JSON, keeping any limits. */
function withMeasurable(
  existing: string | null,
  measurable: string | null,
): string | null {
  const spec: Record<string, unknown> = existing ? JSON.parse(existing) : {};
  if (measurable) spec.summary = measurable;
  return Object.keys(spec).length ? JSON.stringify(spec) : null;
}

/**
 * Apply a credit's stored AI proposal to its draft requirements: correct in
 * place (origin=ai_corrected), insert gap-filled ones (origin=ai_added), leave
 * "unchanged" rows alone. Sets ai_status=applied. Returns counts.
 */
export async function applyStoredProposal(
  parsedCreditId: string,
): Promise<{ added: number; corrected: number }> {
  const [credit] = await db
    .select()
    .from(parsedCredits)
    .where(eq(parsedCredits.id, parsedCreditId));
  if (!credit?.aiProposal) throw new Error("no proposal to apply");
  const proposal = JSON.parse(credit.aiProposal) as StoredProposal;

  const existing = await db
    .select()
    .from(parsedRequirements)
    .where(eq(parsedRequirements.parsedCreditId, parsedCreditId));
  const bySeq = new Map(existing.map((r) => [r.seq, r] as const));
  let maxSeq = Math.max(0, ...existing.map((r) => r.seq));

  let added = 0;
  let corrected = 0;
  for (const p of proposal.requirements) {
    if (p.change === "unchanged") continue;
    const row = bySeq.get(p.seq);
    if (row) {
      await db
        .update(parsedRequirements)
        .set({
          title: p.proposed.title,
          text: p.proposed.text,
          metricType: p.proposed.metricType,
          unit: p.proposed.unit,
          pointsRaw: p.proposed.pointsRaw,
          numericSpec: withMeasurable(row.numericSpec, p.proposed.measurable),
          origin: "ai_corrected",
        })
        .where(eq(parsedRequirements.id, row.id));
      corrected++;
    } else {
      // Defensive: an added row must get a valid, non-colliding seq.
      const seq = p.seq > 0 && !bySeq.has(p.seq) ? p.seq : ++maxSeq;
      await db.insert(parsedRequirements).values({
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        parsedCreditId,
        seq,
        title: p.proposed.title,
        text: p.proposed.text,
        metricType: p.proposed.metricType,
        unit: p.proposed.unit,
        pointsRaw: p.proposed.pointsRaw,
        numericSpec: withMeasurable(null, p.proposed.measurable),
        evidenceSpecs: "[]",
        origin: "ai_added",
      });
      added++;
    }
  }

  await db
    .update(parsedCredits)
    .set({ aiStatus: "applied" })
    .where(eq(parsedCredits.id, parsedCreditId));
  return { added, corrected };
}

// ---------- authoring helpers (ensure rating system / version) ----------

export async function ensureRatingSystem(input: {
  key: string;
  name: string;
  authority?: string;
  country?: string;
}) {
  const [existing] = await db
    .select()
    .from(ratingSystems)
    .where(
      and(
        eq(ratingSystems.workspaceId, WORKSPACE_ID),
        eq(ratingSystems.key, input.key),
      ),
    );
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(ratingSystems).values({
    id,
    workspaceId: WORKSPACE_ID,
    key: input.key,
    name: input.name,
    authority: input.authority ?? null,
    country: input.country ?? null,
  });
  return id;
}

export async function ensureVersion(input: {
  ratingSystemId: string;
  scheme: string;
  stage: string;
  versionLabel: string;
  status?: string;
}) {
  const [existing] = await db
    .select()
    .from(rsVersions)
    .where(
      and(
        eq(rsVersions.ratingSystemId, input.ratingSystemId),
        eq(rsVersions.scheme, input.scheme),
        eq(rsVersions.stage, input.stage),
        eq(rsVersions.versionLabel, input.versionLabel),
      ),
    );
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(rsVersions).values({
    id,
    workspaceId: WORKSPACE_ID,
    ratingSystemId: input.ratingSystemId,
    scheme: input.scheme,
    stage: input.stage,
    versionLabel: input.versionLabel,
    status: input.status ?? "draft",
  });
  return id;
}
