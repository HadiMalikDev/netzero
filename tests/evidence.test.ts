import { describe, expect, it } from "vitest";
import { documentScope, splitBySpec } from "@/lib/evidence";
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

  it("either/or: open and chosen count, a set-aside option is hidden", () => {
    expect(documentScope(mandatory, "open")).toEqual({ show: true, counted: true, tag: "either" });
    expect(documentScope(mandatory, "chosen").tag).toBe("pursuing");
    expect(documentScope(mandatory, "dropped").show).toBe(false);
  });
});
