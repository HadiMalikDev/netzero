import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  parsedCredits,
  parsedRequirements,
  ratingSystems,
  requirementEntries,
  rsVersions,
  sourceDocuments,
} from "@/db/schema";
import { reconcileFromParts } from "@/lib/parser/reconcile";
import { bandsFromSpec, firstBands, formatPointsSpan } from "@/lib/points";
import type {
  Applicability,
  BandSet,
  EvidenceItem,
  NumericSpec,
} from "@/lib/parser/types";
import type { RsVersion } from "@/db/schema";

/** Canonical single-tenant workspace id (re-exported by `@/lib/data`). */
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

/** How many of a version's credits already have an AI reviewer note. */
export async function getReviewNoteProgress(
  versionId: string,
): Promise<{ withNote: number; total: number }> {
  const rows = await db
    .select({ reviewNote: catalogCredits.reviewNote })
    .from(catalogCredits)
    .where(eq(catalogCredits.rsVersionId, versionId));
  return {
    withNote: rows.filter((r) => Boolean(r.reviewNote)).length,
    total: rows.length,
  };
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

// ---------- whole-version export (extraction-review PDF) ----------

export interface ExportRequirement {
  seq: number;
  title: string | null;
  text: string;
  metricType: string;
  unit: string | null;
  pointsRaw: string | null;
  pointsType: string | null;
  optionGroup: string | null;
  keystone: boolean;
  keystoneCondition: string | null;
  measurable: string | null; // summarizeSpec()
  spec: NumericSpec | null;
  bands: BandSet[]; // bandsFromSpec()
  evidence: EvidenceItem[];
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
}

export interface ExportCredit {
  code: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  isKeystone: boolean;
  pointsRaw: string | null;
  aim: string | null;
  reviewNote: string | null;
  references: string[];
  applicability: Applicability | null;
  reconciliation: ReconcileView | null;
  supportingGuidance: string | null;
  toolRef: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  requirements: ExportRequirement[];
}

export interface ExportCategory {
  code: string;
  name: string;
  credits: ExportCredit[];
}

export interface VersionExport {
  version: RsVersion;
  ratingSystemName: string;
  source: { fileName: string; pageCount: number | null } | null;
  categories: ExportCategory[];
  totals: { credits: number; requirements: number; reviewNotes: number };
}

function parseJsonOr<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * The full canonical catalog of a version, grouped by category, with every
 * requirement and its parsed JSON blobs resolved. Backs the extraction-review
 * PDF. One credit query + one requirement query — no per-credit round-trips.
 */
export async function getVersionForExport(
  versionId: string,
): Promise<VersionExport | null> {
  const v = await getVersion(versionId);
  if (!v) return null;

  const credits = await db
    .select()
    .from(catalogCredits)
    .where(eq(catalogCredits.rsVersionId, versionId))
    .orderBy(catalogCredits.categoryCode, catalogCredits.code);

  const reqsByCredit = new Map<string, ExportRequirement[]>();
  if (credits.length) {
    const reqs = await db
      .select()
      .from(catalogRequirements)
      .where(
        inArray(
          catalogRequirements.catalogCreditId,
          credits.map((c) => c.id),
        ),
      )
      .orderBy(catalogRequirements.seq);
    for (const r of reqs) {
      const spec = parseJsonOr<NumericSpec | null>(r.numericSpec, null);
      const arr = reqsByCredit.get(r.catalogCreditId) ?? [];
      arr.push({
        seq: r.seq,
        title: r.title,
        text: r.text,
        metricType: r.metricType,
        unit: r.unit,
        pointsRaw: r.pointsRaw,
        pointsType: r.pointsType,
        optionGroup: r.optionGroup,
        keystone: r.keystone,
        keystoneCondition: r.keystoneCondition,
        measurable: summarizeSpec(r.numericSpec),
        spec,
        bands: bandsFromSpec(spec),
        evidence: parseJsonOr<EvidenceItem[]>(r.evidence, []),
        sourcePageStart: r.sourcePageStart,
        sourcePageEnd: r.sourcePageEnd,
      });
      reqsByCredit.set(r.catalogCreditId, arr);
    }
  }

  const groups = new Map<string, ExportCategory>();
  let requirementCount = 0;
  let reviewNoteCount = 0;
  for (const c of credits) {
    const requirements = reqsByCredit.get(c.id) ?? [];
    requirementCount += requirements.length;
    if (c.reviewNote) reviewNoteCount++;
    const g =
      groups.get(c.categoryCode) ??
      ({ code: c.categoryCode, name: c.categoryName, credits: [] } as ExportCategory);
    g.credits.push({
      code: c.code,
      title: c.title,
      categoryCode: c.categoryCode,
      categoryName: c.categoryName,
      isKeystone: c.isKeystone,
      pointsRaw: c.pointsRaw,
      aim: c.aim,
      reviewNote: c.reviewNote,
      references: parseJsonOr<string[]>(c.references, []),
      applicability: parseJsonOr<Applicability | null>(c.applicability, null),
      reconciliation: parseJsonOr<ReconcileView | null>(c.reconciliation, null),
      supportingGuidance: c.supportingGuidance,
      toolRef: c.toolRef,
      sourcePageStart: c.sourcePageStart,
      sourcePageEnd: c.sourcePageEnd,
      requirements,
    });
    groups.set(c.categoryCode, g);
  }

  // Source manual: prefer the promoted document, else any parsed one — mirrors
  // /api/manual so the "compare against the manual" pages line up.
  const docs = await db
    .select({ fileName: sourceDocuments.fileName, pageCount: sourceDocuments.pageCount, status: sourceDocuments.status })
    .from(sourceDocuments)
    .where(eq(sourceDocuments.rsVersionId, versionId));
  const chosen = docs.find((d) => d.status === "promoted") ?? docs[0];

  return {
    version: v.version,
    ratingSystemName: v.ratingSystemName,
    source: chosen
      ? { fileName: chosen.fileName, pageCount: chosen.pageCount }
      : null,
    categories: [...groups.values()].sort((a, b) => a.code.localeCompare(b.code)),
    totals: {
      credits: credits.length,
      requirements: requirementCount,
      reviewNotes: reviewNoteCount,
    },
  };
}

// ---------- parsed drafts (catalog authoring / review) ----------

export interface ParsedDraftRequirement {
  seq: number;
  title: string | null;
  text: string;
  metricType: string;
  unit: string | null;
  pointsRaw: string | null;
  pointsType: string | null; // fixed | scaled | shared
  optionGroup: string | null; // XOR group label when the credit offers options
  keystone: boolean;
  hasEvidence: boolean;
  evidenceByStage: Record<string, number>; // e.g. { design: 1, construction: 3 }
  measurable: string | null; // human-readable target, if extracted
  origin: string; // deterministic | ai_added | ai_corrected
  pageStart: number | null;
}

/** Count evidence items per submission stage from the stored JSON blob. */
function evidenceStageCounts(json: string | null): Record<string, number> {
  if (!json) return {};
  try {
    const items = JSON.parse(json) as { stage?: string }[];
    const out: Record<string, number> = {};
    for (const it of items) {
      const s = it.stage ?? "unknown";
      out[s] = (out[s] ?? 0) + 1;
    }
    return out;
  } catch {
    return {};
  }
}

interface NumericSpecShape {
  summary?: string;
  limits?: { name: string; op: string; value: number; unit: string }[];
  threshold?: { op: string; value: number; unit: string | null };
  bands?: { label: string | null; bands: { min: number; points: number }[] }[];
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
  const bands = firstBands(spec);
  if (bands.length) {
    const pts = bands.map((b) => b.points);
    return `${formatPointsSpan(Math.min(...pts), Math.max(...pts))} pts by % improvement`;
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

export interface ReconcileView {
  ok: boolean;
  expected: number | null;
  got: number | null;
  note: string;
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
  reconciliation: ReconcileView | null; // extractor ↔ manual self-check
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
        reconciliation: c.reconciliation
          ? (JSON.parse(c.reconciliation) as ReconcileView)
          : null,
        proposal,
        requirements: reqs.map((r) => {
          const byStage = evidenceStageCounts(r.evidence);
          const evCount = Object.values(byStage).reduce((a, b) => a + b, 0);
          return {
            seq: r.seq,
            title: r.title,
            text: r.text,
            metricType: r.metricType,
            unit: r.unit,
            pointsRaw: r.pointsRaw,
            pointsType: r.pointsType,
            optionGroup: r.optionGroup,
            keystone: r.keystone,
            hasEvidence: evCount > 0
              || (r.evidenceSpecs
                ? (JSON.parse(r.evidenceSpecs) as string[]).length > 0
                : false),
            evidenceByStage: byStage,
            measurable: summarizeSpec(r.numericSpec),
            origin: r.origin,
            pageStart: r.pageStart,
          };
        }),
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
    const creditValues = {
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
      applicability: d.applicability,
      supportingGuidance: d.supportingGuidance,
      toolRef: d.toolRef,
      reconciliation: d.reconciliation,
      sourcePageStart: d.pageStart,
      sourcePageEnd: d.pageEnd,
    };

    // Re-promoting a (version, code) refreshes it IN PLACE — the canonical
    // credit/requirement ids are preserved so any project already instantiated
    // from this catalog keeps its foreign-key references (project_credit ->
    // catalog_credit, requirement_entry -> catalog_requirement). A delete +
    // reinsert would orphan those and fail the FK constraint.
    const [existing] = await db
      .select({ id: catalogCredits.id })
      .from(catalogCredits)
      .where(
        and(
          eq(catalogCredits.rsVersionId, rsVersionId),
          eq(catalogCredits.code, d.code),
        ),
      );

    let creditId: string;
    if (existing) {
      creditId = existing.id;
      await db.update(catalogCredits).set(creditValues).where(eq(catalogCredits.id, creditId));
    } else {
      creditId = randomUUID();
      await db.insert(catalogCredits).values({ id: creditId, ...creditValues });
    }

    const reqs = await db
      .select()
      .from(parsedRequirements)
      .where(eq(parsedRequirements.parsedCreditId, d.id))
      .orderBy(parsedRequirements.seq);
    const priorReqs = await db
      .select()
      .from(catalogRequirements)
      .where(eq(catalogRequirements.catalogCreditId, creditId));
    const priorBySeq = new Map(priorReqs.map((r) => [r.seq, r]));

    for (const r of reqs) {
      const reqValues = {
        workspaceId: WORKSPACE_ID,
        catalogCreditId: creditId,
        seq: r.seq,
        title: r.title,
        text: r.text,
        metricType: r.metricType,
        unit: r.unit,
        pointsRaw: r.pointsRaw,
        pointsType: r.pointsType,
        optionGroup: r.optionGroup,
        keystone: r.keystone,
        keystoneCondition: r.keystoneCondition,
        numericSpec: r.numericSpec,
        evidence: r.evidence,
        evidenceSpecs: r.evidenceSpecs,
        sourcePageStart: r.pageStart,
        sourcePageEnd: r.pageEnd,
      };
      // Upsert by seq so a requirement_entry pointing at this seq survives.
      const prior = priorBySeq.get(r.seq);
      if (prior) {
        await db.update(catalogRequirements).set(reqValues).where(eq(catalogRequirements.id, prior.id));
        priorBySeq.delete(r.seq);
      } else {
        await db.insert(catalogRequirements).values({ id: randomUUID(), ...reqValues });
      }
    }
    // Obsolete requirements (a seq the new parse no longer emits): drop only if
    // no project answer references it; otherwise leave it to keep the FK valid.
    for (const orphan of priorBySeq.values()) {
      const refs = await db
        .select({ id: requirementEntries.id })
        .from(requirementEntries)
        .where(eq(requirementEntries.catalogRequirementId, orphan.id));
      if (refs.length === 0)
        await db.delete(catalogRequirements).where(eq(catalogRequirements.id, orphan.id));
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

  // Split the proposal into in-place corrections and net-new additions.
  const corrections = proposal.requirements.filter(
    (p) => p.change !== "unchanged" && bySeq.has(p.seq),
  );
  const additions = proposal.requirements.filter(
    (p) => p.change !== "unchanged" && !bySeq.has(p.seq),
  );

  // Reconcile GATE for additions: the manual's points are deterministic, so a
  // gap-fill is only trusted when it moves the credit's total TOWARD its Total
  // (e.g. recovering a genuinely-missing requirement), never away from it. This
  // stops the verifier from inventing point-bearing rows that overshoot.
  const toParts = (rows: { pointsRaw: string | null; optionGroup: string | null }[]) =>
    rows.map((r) => ({ pointsRaw: r.pointsRaw, optionGroup: r.optionGroup }));
  const cur = reconcileFromParts(credit.pointsRaw, toParts(existing));
  const projected = reconcileFromParts(
    credit.pointsRaw,
    toParts([
      ...existing,
      ...additions.map((p) => ({ pointsRaw: p.proposed.pointsRaw, optionGroup: null })),
    ]),
  );
  // With a known Total, an addition is trusted only if it moves the credit's
  // sum toward that Total, never past it. With no Total there is nothing to
  // overshoot, so the gate can't apply — allow the gap-fill.
  const keepAdditions =
    cur.expected == null ||
    Math.abs((projected.got ?? 0) - cur.expected) <=
      Math.abs((cur.got ?? 0) - cur.expected);

  let added = 0;
  let corrected = 0;

  // Corrections: refine text / metric_type / unit / measurable target, but NEVER
  // the points column — points come from the source table, not the model.
  for (const p of corrections) {
    const row = bySeq.get(p.seq)!;
    await db
      .update(parsedRequirements)
      .set({
        title: p.proposed.title,
        text: p.proposed.text,
        metricType: p.proposed.metricType,
        unit: p.proposed.unit,
        numericSpec: withMeasurable(row.numericSpec, p.proposed.measurable),
        origin: "ai_corrected",
      })
      .where(eq(parsedRequirements.id, row.id));
    corrected++;
  }

  // Additions: only when the reconcile gate approves (otherwise dropped).
  if (keepAdditions) {
    for (const p of additions) {
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
        evidence: "[]",
        evidenceSpecs: "[]",
        // An added row has no span of its own — inherit the credit's pages.
        pageStart: credit.pageStart,
        pageEnd: credit.pageEnd,
        origin: "ai_added",
      });
      added++;
    }
  }

  // Re-reconcile against the manual's Total using the FINAL requirement set (the
  // parse-time flag is stale once the AI has added/corrected rows).
  const finalReqs = await db
    .select({ pointsRaw: parsedRequirements.pointsRaw, optionGroup: parsedRequirements.optionGroup })
    .from(parsedRequirements)
    .where(eq(parsedRequirements.parsedCreditId, parsedCreditId));
  const recon = reconcileFromParts(credit.pointsRaw, finalReqs);

  await db
    .update(parsedCredits)
    .set({ aiStatus: "applied", reconciliation: JSON.stringify(recon) })
    .where(eq(parsedCredits.id, parsedCreditId));
  return { added, corrected };
}

// ---------- human draft edit (replace-set; testable) ----------

export interface DraftReqInput {
  seq: number;
  title: string | null;
  text: string;
  pointsRaw: string | null;
  metricType: string;
  unit: string | null;
  optionGroup: string | null;
  pointsType: string | null;
}

export async function saveParsedCredit(
  parsedCreditId: string,
  fields: { title?: string; pointsRaw?: string | null },
): Promise<void> {
  const [credit] = await db
    .select()
    .from(parsedCredits)
    .where(eq(parsedCredits.id, parsedCreditId));
  if (!credit) throw new Error("credit not found");
  const patch: { title?: string; pointsRaw?: string | null; reconciliation?: string } = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.pointsRaw !== undefined) patch.pointsRaw = fields.pointsRaw;
  if (Object.keys(patch).length === 0) return;

  const pointsRaw = fields.pointsRaw !== undefined ? fields.pointsRaw : credit.pointsRaw;
  const reqs = await db
    .select({
      pointsRaw: parsedRequirements.pointsRaw,
      optionGroup: parsedRequirements.optionGroup,
    })
    .from(parsedRequirements)
    .where(eq(parsedRequirements.parsedCreditId, parsedCreditId));
  patch.reconciliation = JSON.stringify(reconcileFromParts(pointsRaw, reqs));

  await db
    .update(parsedCredits)
    .set(patch)
    .where(eq(parsedCredits.id, parsedCreditId));
}

/** Replace the requirement set for a draft credit and restamp reconcile. */
export async function saveParsedRequirements(
  parsedCreditId: string,
  rows: DraftReqInput[],
): Promise<void> {
  const [credit] = await db
    .select()
    .from(parsedCredits)
    .where(eq(parsedCredits.id, parsedCreditId));
  if (!credit) throw new Error("credit not found");

  const existing = await db
    .select()
    .from(parsedRequirements)
    .where(eq(parsedRequirements.parsedCreditId, parsedCreditId));
  const bySeq = new Map(existing.map((r) => [r.seq, r]));
  const keep = new Set(rows.map((r) => r.seq));

  for (const row of existing) {
    if (!keep.has(row.seq))
      await db.delete(parsedRequirements).where(eq(parsedRequirements.id, row.id));
  }

  for (const r of rows) {
    const prior = bySeq.get(r.seq);
    const values = {
      seq: r.seq,
      title: r.title,
      text: r.text,
      pointsRaw: r.pointsRaw,
      metricType: r.metricType,
      unit: r.unit,
      optionGroup: r.optionGroup,
      pointsType: r.pointsType,
    };
    if (prior) {
      await db
        .update(parsedRequirements)
        .set(values)
        .where(eq(parsedRequirements.id, prior.id));
    } else {
      await db.insert(parsedRequirements).values({
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        parsedCreditId,
        ...values,
        evidence: "[]",
        evidenceSpecs: "[]",
        pageStart: credit.pageStart,
        pageEnd: credit.pageEnd,
        origin: "deterministic",
      });
    }
  }

  const recon = reconcileFromParts(
    credit.pointsRaw,
    rows.map((r) => ({ pointsRaw: r.pointsRaw, optionGroup: r.optionGroup })),
  );
  await db
    .update(parsedCredits)
    .set({ reconciliation: JSON.stringify(recon) })
    .where(eq(parsedCredits.id, parsedCreditId));
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
