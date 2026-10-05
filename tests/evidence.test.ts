import { describe, expect, it } from "vitest";
import {
  docGates,
  docsDueProvided,
  documentScope,
  documentSections,
  parseStage,
  splitBySpec,
} from "@/lib/evidence";
import type { EvidenceAttachment } from "@/lib/data";

const file = (id: string, evidenceSpecIndex: number | null): EvidenceAttachment => ({
  id,
  fileName: `${id}.pdf`,
  fileSize: 1,
  createdAt: 0,
  evidenceSpecIndex,
  review: null,
});

describe("splitBySpec", () => {
  it("ticks a document only when a file is attached against it", () => {
    const r = splitBySpec(["LSP", "Letter"], [file("a", 0), file("b", 0)]);
    expect(r.provided).toBe(1);
    expect(r.bySpec.get(0)?.map((f) => f.id)).toEqual(["a", "b"]);
    expect(r.unassigned).toEqual([]);
  });

  it("files with no slot, or a slot past the list, are other files", () => {
    const r = splitBySpec(["LSP"], [file("a", null), file("b", 3)]);
    expect(r.provided).toBe(0);
    expect(r.unassigned.map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("documentScope", () => {
  const mandatory = { optional: false, status: "not_started" as const };

  it("a mandatory row is shown and counted", () => {
    expect(documentScope(mandatory)).toEqual({ show: true, counted: true, tag: null });
  });

  it("an untouched optional row is shown but not counted", () => {
    expect(documentScope({ optional: true, status: "not_started" })).toEqual({
      show: true,
      counted: false,
      tag: "optional",
    });
  });

  it("a started optional row counts", () => {
    expect(documentScope({ optional: true, status: "in_progress" }).counted).toBe(true);
  });

  it("either/or: only the chosen path shows its documents", () => {
    expect(documentScope(mandatory, "open").show).toBe(false);
    expect(documentScope(mandatory, "chosen")).toEqual({ show: true, counted: true, tag: "pursuing" });
    expect(documentScope(mandatory, "dropped").show).toBe(false);
  });
});

describe("docGates", () => {
  const stages = ["design", "construction", null];

  it("at design stage, construction documents are listed but not due", () => {
    expect(docGates(stages, "design")).toEqual([true, false, true]);
  });

  it("at construction stage every document is due", () => {
    expect(docGates(stages, "construction")).toEqual([true, true, true]);
  });

  it("an unknown stage value reads as design", () => {
    expect(parseStage("whatever")).toBe("design");
    expect(parseStage("construction")).toBe("construction");
  });

  it("counts due documents and the due ones provided", () => {
    const { bySpec } = splitBySpec(["a", "b", "c"], [file("x", 1), file("y", 2)]);
    expect(docsDueProvided(docGates(stages, "design"), bySpec)).toEqual({ due: 2, provided: 1 });
    expect(docsDueProvided(docGates(stages, "construction"), bySpec)).toEqual({ due: 3, provided: 2 });
  });
});

describe("documentSections", () => {
  const r = (entryId: string, optionGroup: string | null = null) => ({
    entryId,
    optionGroup,
    optional: false,
    status: "not_started" as const,
  });
  const reqs = [r("a"), r("x1", "E-01 options"), r("x2", "E-01 options")];

  it("an either/or group with no path picked is one choose step", () => {
    const { sections, setAside } = documentSections(
      reqs,
      new Map([["x1", "open"], ["x2", "open"]] as const),
    );
    expect(sections.map((s) => s.kind)).toEqual(["docs", "choose"]);
    expect(sections[1].kind === "choose" && sections[1].options.map((o) => o.entryId)).toEqual(["x1", "x2"]);
    expect(setAside).toEqual([]);
  });

  it("once picked, only the chosen path's documents show", () => {
    const { sections, setAside } = documentSections(
      reqs,
      new Map([["x1", "dropped"], ["x2", "chosen"]] as const),
    );
    expect(sections.map((s) => (s.kind === "docs" ? s.req.entryId : "choose"))).toEqual(["a", "x2"]);
    expect(setAside.map((x) => x.entryId)).toEqual(["x1"]);
  });
});
