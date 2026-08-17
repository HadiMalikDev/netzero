/**
 * Derived status — the ONLY status model in Stage 1. There are no points, no
 * tier, no owners, no due dates. "Overdue" (in the assistant) means incomplete /
 * missing evidence, never a calendar date.
 *
 * Rules (per docs/corrections/2026-08-16-stage-1-spec.md), plus XOR:
 *   requirement:
 *     not_started  — no value and no evidence
 *     in_progress  — some value and/or evidence, but not satisfied
 *     completed    — has a value AND (if the extract listed evidence) >=1 file
 *   credit: each ungrouped requirement must be completed; each XOR group
 *     needs ANY one option completed. not_started if nothing is touched;
 *     otherwise in_progress until every slot is satisfied.
 */

import { mapByOption } from "./option-group";

export type Status = "not_started" | "in_progress" | "completed";

export interface CreditStatusReq {
  status: Status;
  optionGroup?: string | null;
}

export interface EntryState {
  metricType: string;
  requiresEvidence: boolean; // extract listed evidence specs
  valueBool: boolean | null;
  valueNumber: number | null;
  valueText: string | null;
  evidenceCount: number;
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
  const evidenceOk = e.requiresEvidence ? e.evidenceCount > 0 : true;
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
  if (reqs.length === 0) return "not_started";
  const parts = mapByOption(
    reqs,
    (items) => xorBlockStatus(items.map((i) => i.status)),
    (item) => item.status,
  );
  if (parts.every((s) => s === "completed")) return "completed";
  if (parts.every((s) => s === "not_started")) return "not_started";
  return "in_progress";
}

/** Rows that still block credit completion. A satisfied XOR group drops every option. */
export function blockingRequirements<T extends CreditStatusReq>(reqs: T[]): T[] {
  return mapByOption(
    reqs,
    (items) => (items.some((i) => i.status === "completed") ? [] : items),
    (item) => (item.status !== "completed" ? [item] : []),
  ).flat();
}

export function missingEvidenceRequirements<
  T extends CreditStatusReq & { requiresEvidence: boolean; evidenceCount: number },
>(reqs: T[]): T[] {
  return blockingRequirements(reqs).filter(
    (r) => r.requiresEvidence && r.evidenceCount === 0,
  );
}
