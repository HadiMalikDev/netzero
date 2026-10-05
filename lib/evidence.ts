import type { EvidenceAttachment, RequirementView } from "./data";
import type { PathState } from "./option-group";

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

export type DocTag = "pursuing" | "either" | "optional";

/**
 * How a requirement's documents appear in the credit's Required documents box.
 *  - a set-aside either/or option is not shown at all;
 *  - an optional row nobody has started is shown but not counted;
 *  - everything else is shown and counted toward "X of N provided".
 */
export function documentScope(
  req: Pick<RequirementView, "optional" | "status">,
  path?: PathState,
): { show: boolean; counted: boolean; tag: DocTag | null } {
  if (path === "dropped") return { show: false, counted: false, tag: null };
  if (req.optional)
    return { show: true, counted: req.status !== "not_started", tag: "optional" };
  if (path === "chosen") return { show: true, counted: true, tag: "pursuing" };
  if (path === "open") return { show: true, counted: true, tag: "either" };
  return { show: true, counted: true, tag: null };
}
