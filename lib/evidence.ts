import type { EvidenceAttachment, RequirementView } from "./data";
import { groupByOption, type PathState } from "./option-group";

/**
 * Attachments grouped by the required document they provide. An index past
 * the end of the list (a re-parsed catalog, say) counts as unassigned rather
 * than dropping from view.
 */
export function splitBySpec(specs: string[], attachments: EvidenceAttachment[]) {
  const bySpec = new Map<number, EvidenceAttachment[]>();
  const unassigned: EvidenceAttachment[] = [];
  for (const a of attachments) {
    if (a.evidenceSpecIndex != null && a.evidenceSpecIndex < specs.length) {
      const arr = bySpec.get(a.evidenceSpecIndex) ?? [];
      arr.push(a);
      bySpec.set(a.evidenceSpecIndex, arr);
    } else {
      unassigned.push(a);
    }
  }
  const provided = specs.filter((_, i) => (bySpec.get(i)?.length ?? 0) > 0).length;
  return { bySpec, unassigned, provided };
}

export type ProjectStage = "design" | "construction";

export function parseStage(raw: unknown): ProjectStage {
  return raw === "construction" ? "construction" : "design";
}

/**
 * Which listed documents are due now (index-aligned with evidence_specs). At
 * design stage, construction-stage documents are listed but not yet due; at
 * construction stage everything is. A document with no stage tag is always due
 * — the safe reading when the extract did not say.
 */
export function docGates(
  stages: (string | null)[],
  projectStage: ProjectStage,
): boolean[] {
  return stages.map((s) => projectStage === "construction" || s !== "construction");
}

/** Due documents, and how many of them have a file against them. */
export function docsDueProvided(
  gates: boolean[],
  bySpec: Map<number, EvidenceAttachment[]>,
): { due: number; provided: number } {
  let due = 0;
  let provided = 0;
  gates.forEach((g, i) => {
    if (!g) return;
    due++;
    if ((bySpec.get(i)?.length ?? 0) > 0) provided++;
  });
  return { due, provided };
}

export type DocTag = "pursuing" | "optional";

/**
 * How a requirement's documents appear in the credit's Required documents box.
 *  - an either/or option shows its documents only once it is the chosen path:
 *    until then the group is one "pick a path" step, and set-aside options
 *    are left out;
 *  - an optional row nobody has started is shown but not counted;
 *  - everything else is shown and counted toward "X of N provided".
 */
export function documentScope(
  req: Pick<RequirementView, "optional" | "status">,
  path?: PathState,
): { show: boolean; counted: boolean; tag: DocTag | null } {
  if (path === "dropped" || path === "open")
    return { show: false, counted: false, tag: null };
  if (req.optional)
    return { show: true, counted: req.status !== "not_started", tag: "optional" };
  if (path === "chosen") return { show: true, counted: true, tag: "pursuing" };
  return { show: true, counted: true, tag: null };
}

export type DocSection<R = RequirementView> =
  | { kind: "docs"; req: R; counted: boolean; tag: DocTag | null }
  /** An either/or group with no path picked: choose first, documents after. */
  | { kind: "choose"; options: R[] };

/**
 * The Required documents box, in requirement order: one docs section per
 * requirement shown, one "choose" section per either/or group still open, and
 * the set-aside options listed apart.
 */
export function documentSections<
  R extends Pick<RequirementView, "entryId" | "optional" | "status" | "optionGroup">,
>(reqs: R[], paths: Map<string, PathState>): { sections: DocSection<R>[]; setAside: R[] } {
  const sections: DocSection<R>[] = [];
  const setAside: R[] = [];
  for (const block of groupByOption(reqs)) {
    const items = block.kind === "xor" ? block.items : [block.item];
    if (block.kind === "xor" && items.every((r) => paths.get(r.entryId) === "open")) {
      sections.push({ kind: "choose", options: items });
      continue;
    }
    for (const req of items) {
      const scope = documentScope(req, paths.get(req.entryId));
      if (scope.show) sections.push({ kind: "docs", req, counted: scope.counted, tag: scope.tag });
      else setAside.push(req);
    }
  }
  return { sections, setAside };
}
