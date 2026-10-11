import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  checklistInspections,
  checklistObservations,
  checklistTemplates,
  projectCredits,
  users,
} from "@/db/schema";
import { WORKSPACE_ID } from "@/lib/catalog";
import type { InspectionSummary } from "@/lib/checklists";

/**
 * The project's Reports page (Sprint 2 item 4): every credit that has an
 * inspection form — HC-10 (IAQ) and SS-03 (ESC) today — with the form, every
 * inspection generated so far and the open observations. The same credits
 * the Inspections button appears on; nothing here creates or copies a form.
 */

export interface ReportForm {
  projectCreditId: string;
  code: string;
  creditTitle: string;
  /** The project's own copy when it has one, else the standard form it will copy. */
  formTitle: string;
  ownCopy: boolean;
  observationLog: boolean;
  observationTitle: string;
  openObservations: number;
  inspections: InspectionSummary[];
}

export async function projectReportForms(projectId: string): Promise<ReportForm[]> {
  const credits = await db
    .select({ projectCreditId: projectCredits.id, code: catalogCredits.code, title: catalogCredits.title })
    .from(projectCredits)
    .innerJoin(catalogCredits, eq(projectCredits.catalogCreditId, catalogCredits.id))
    .where(and(eq(projectCredits.projectId, projectId), eq(projectCredits.workspaceId, WORKSPACE_ID)))
    .orderBy(asc(catalogCredits.code));
  if (!credits.length) return [];

  const formCols = {
    id: checklistTemplates.id,
    projectCreditId: checklistTemplates.projectCreditId,
    creditTitle: checklistTemplates.creditTitle,
    title: checklistTemplates.title,
    observationLog: checklistTemplates.observationLog,
    observationTitle: checklistTemplates.observationTitle,
  };
  const own = await db
    .select(formCols)
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.workspaceId, WORKSPACE_ID),
        inArray(checklistTemplates.projectCreditId, credits.map((c) => c.projectCreditId)),
      ),
    );
  const defaults = await db
    .select(formCols)
    .from(checklistTemplates)
    .where(and(eq(checklistTemplates.workspaceId, WORKSPACE_ID), isNull(checklistTemplates.projectCreditId)))
    .orderBy(asc(checklistTemplates.createdAt));
  const ownByCredit = new Map(own.map((t) => [t.projectCreditId!, t]));
  // Same matching as defaultTemplateFor: by credit title, case aside, oldest first.
  const defaultByTitle = new Map<string, (typeof defaults)[number]>();
  for (const d of defaults) {
    const k = d.creditTitle.toLowerCase();
    if (!defaultByTitle.has(k)) defaultByTitle.set(k, d);
  }

  const ownIds = own.map((t) => t.id);
  const inspections = ownIds.length
    ? await db
        .select({
          id: checklistInspections.id,
          templateId: checklistInspections.templateId,
          inspectionDate: checklistInspections.inspectionDate,
          inspector: checklistInspections.inspector,
          area: checklistInspections.area,
          aiState: checklistInspections.aiState,
          reviewedAt: checklistInspections.reviewedAt,
          reviewedByName: users.name,
          createdAt: checklistInspections.createdAt,
        })
        .from(checklistInspections)
        .leftJoin(users, eq(checklistInspections.reviewedBy, users.id))
        .where(and(eq(checklistInspections.workspaceId, WORKSPACE_ID), inArray(checklistInspections.templateId, ownIds)))
        .orderBy(desc(checklistInspections.createdAt))
    : [];
  const openCounts = ownIds.length
    ? await db
        .select({ templateId: checklistObservations.templateId, n: sql<number>`count(*)::int` })
        .from(checklistObservations)
        .where(and(inArray(checklistObservations.templateId, ownIds), eq(checklistObservations.status, "open")))
        .groupBy(checklistObservations.templateId)
    : [];
  const openByTemplate = new Map(openCounts.map((o) => [o.templateId, Number(o.n)]));

  const out: ReportForm[] = [];
  for (const c of credits) {
    const mine = ownByCredit.get(c.projectCreditId);
    const form = mine ?? defaultByTitle.get(c.title.toLowerCase());
    if (!form) continue;
    out.push({
      projectCreditId: c.projectCreditId,
      code: c.code,
      creditTitle: c.title,
      formTitle: form.title,
      ownCopy: Boolean(mine),
      observationLog: form.observationLog,
      observationTitle: form.observationTitle,
      openObservations: mine ? (openByTemplate.get(mine.id) ?? 0) : 0,
      inspections: mine
        ? inspections.filter((i) => i.templateId === mine.id)
        : [],
    });
  }
  return out;
}
