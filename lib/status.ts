/**
 * Derived status — the ONLY status model in Stage 1. There are no points, no
 * tier, no owners, no due dates. "Overdue" (in the assistant) means incomplete /
 * missing evidence, never a calendar date.
 *
 * Rules (per docs/corrections/2026-08-16-stage-1-spec.md):
 *   requirement:
 *     not_started  — no value and no evidence
 *     in_progress  — some value and/or evidence, but not satisfied
 *     completed    — has a value AND (if the extract listed evidence) >=1 file
 *   credit: not_started if all reqs not_started; completed if all completed;
 *           otherwise in_progress.
 */

export type Status = "not_started" | "in_progress" | "completed";

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

export function deriveCreditStatus(reqStatuses: Status[]): Status {
  if (reqStatuses.length === 0) return "not_started";
  if (reqStatuses.every((s) => s === "completed")) return "completed";
  if (reqStatuses.every((s) => s === "not_started")) return "not_started";
  return "in_progress";
}
