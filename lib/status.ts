/**
 * Derived status — the ONLY status model in Stage 1. There are no points, no
 * tier, no owners, no due dates. "Overdue" (in the assistant) means incomplete /
 * missing evidence, never a calendar date.
 *
 * Rules (per docs/corrections/2026-08-16-stage-1-spec.md), plus XOR:
 *   requirement:
 *     not_started  — no value and no evidence
 *     in_progress  — some value and/or evidence, but not satisfied
 *     completed    — has a value AND its evidence is satisfied: every listed
 *                    document due at the project's stage has a file attached
 *                    against it, or — when the manual lists none — >=1 file
 *   credit: each mandatory requirement must be completed; each XOR group
 *     needs ANY one option completed. not_started if nothing is touched;
 *     otherwise in_progress until every slot is satisfied.
 *
 * Two kinds of row are out of scope for the credit (see `inScope`):
 *   - an XOR option the project chose not to pursue (`planned === false`);
 *   - an optional row (adds points, never required) nobody has started. Once
 *     started it must be finished, so a half-done optional row still blocks.
 */

import { parseNum } from "./num";
import { mapByOption } from "./option-group";

export type Status = "not_started" | "in_progress" | "completed";

export interface CreditStatusReq {
  status: Status;
  optionGroup?: string | null;
  /** false = an either/or option the project chose not to pursue. */
  planned?: boolean;
  /** Adds points but is never required — see `optionalFlags`. */
  optional?: boolean;
}

interface OptionalInput {
  optionGroup?: string | null;
  keystone: boolean;
  pointsRaw: string | null;
}

/**
 * Which rows of ONE credit are optional (index-aligned). A row is optional when
 * it sits outside an either/or group, is not a keystone requirement, earns
 * points of its own, and is not the credit's only way to earn points (e.g.
 * W-02 #2–#5). Rows without points are prerequisites ("In addition to #1…"),
 * and a credit's sole point-earning row is the credit itself (PMM-03), so both
 * stay mandatory.
 */
export function optionalFlags(reqs: OptionalInput[]): boolean[] {
  const earns = reqs.map((r) => (parseNum(r.pointsRaw) ?? 0) > 0);
  const earning = earns.filter(Boolean).length;
  return reqs.map(
    (r, i) => !r.optionGroup?.trim() && !r.keystone && earns[i] && earning > 1,
  );
}

/** Drop rows the credit does not depend on: unchosen XOR options, untouched optional rows. */
export function inScope<T extends CreditStatusReq>(reqs: T[]): T[] {
  return reqs.filter(
    (r) => r.planned !== false && !(r.optional && r.status === "not_started"),
  );
}

/** Optional rows nobody has started — open points, never blockers. */
export function untouchedOptional<T extends CreditStatusReq>(reqs: T[]): T[] {
  return reqs.filter((r) => r.optional && r.status === "not_started");
}

export interface EntryState {
  metricType: string;
  requiresEvidence: boolean;
  valueBool: boolean | null;
  valueNumber: number | null;
  valueText: string | null;
  evidenceCount: number;
  /** Listed documents due at the project's stage (see lib/evidence.ts docGates). */
  docsDue?: number;
  /** How many of those have at least one file attached against them. */
  docsProvided?: number;
}

/**
 * Evidence is satisfied when every listed document due at the project's stage
 * has a file attached against it. A requirement whose manual entry lists no
 * documents falls back to "at least one file".
 */
export function evidenceSatisfied(
  e: Pick<EntryState, "requiresEvidence" | "evidenceCount" | "docsDue" | "docsProvided">,
): boolean {
  if (!e.requiresEvidence) return true;
  const due = e.docsDue ?? 0;
  return due > 0 ? (e.docsProvided ?? 0) >= due : e.evidenceCount > 0;
}

export function hasValue(e: EntryState): boolean {
  switch (e.metricType) {
    case "BOOLEAN":
      return e.valueBool === true;
    case "NUMERIC":
      return e.valueNumber !== null && e.valueNumber !== undefined;
    case "DESCRIPTIVE":
      return !!e.valueText && e.valueText.trim().length > 0;
    default:
      return false;
  }
}

export function deriveRequirementStatus(e: EntryState): Status {
  const value = hasValue(e);
  const evidenceOk = evidenceSatisfied(e);
  const touched = value || e.evidenceCount > 0;

  if (value && evidenceOk) return "completed";
  if (touched) return "in_progress";
  return "not_started";
}

function xorBlockStatus(statuses: Status[]): Status {
  if (statuses.some((s) => s === "completed")) return "completed";
  if (statuses.every((s) => s === "not_started")) return "not_started";
  return "in_progress";
}

export function deriveCreditStatus(reqs: CreditStatusReq[]): Status {
  const parts = mapByOption(
    inScope(reqs),
    (items) => xorBlockStatus(items.map((i) => i.status)),
    (item) => item.status,
  );
  // Nothing in scope means only untouched optional rows: nothing done yet.
  if (parts.length === 0) return "not_started";
  if (parts.every((s) => s === "completed")) return "completed";
  if (parts.every((s) => s === "not_started")) return "not_started";
  return "in_progress";
}

/** Rows that still block credit completion. A satisfied XOR group drops every option. */
export function blockingRequirements<T extends CreditStatusReq>(reqs: T[]): T[] {
  return mapByOption(
    inScope(reqs),
    (items) => (items.some((i) => i.status === "completed") ? [] : items),
    (item) => (item.status !== "completed" ? [item] : []),
  ).flat();
}

/** Blocking rows whose evidence is not yet satisfied (a document still due). */
export function missingEvidenceRequirements<
  T extends CreditStatusReq & {
    requiresEvidence: boolean;
    evidenceCount: number;
    docsDue?: number;
    docsProvided?: number;
  },
>(reqs: T[]): T[] {
  return blockingRequirements(reqs).filter((r) => !evidenceSatisfied(r));
}
