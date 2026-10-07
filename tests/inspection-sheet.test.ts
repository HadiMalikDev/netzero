import { describe, expect, it } from "vitest";
import type { CreditView, EvidenceAttachment, RequirementView } from "@/lib/data";
import { buildInspectionSheet, planFileIds, sheetStage } from "@/lib/report/inspection-sheet";
import {
  IAQ_INSPECTION,
  templateFor,
  templateItems,
} from "@/lib/report/inspection-template";
import { normalizeCoverage } from "@/lib/ai/plan-coverage";

const file = (id: string, idx: number | null, fileName = `${id}.pdf`): EvidenceAttachment => ({
  id,
  fileName,
  fileSize: 10,
  createdAt: 1_759_800_000,
  evidenceSpecIndex: idx,
  review: null,
});

const req = (over: Partial<RequirementView>): RequirementView =>
  ({
    entryId: `e${over.seq}`,
    requirementId: `r${over.seq}`,
    title: null,
    text: "",
    metricType: "BOOLEAN",
    unit: null,
    pointsRaw: "1",
    optionGroup: null,
    pointsType: null,
    keystone: false,
    planned: true,
    optional: false,
    target: null,
    numericSpec: null,
    evidenceSpecs: [],
    evidenceStages: [],
    docGates: [],
    docsListed: 0,
    docsDue: 0,
    docsProvided: 0,
    requiresEvidence: true,
    pageStart: null,
    pageEnd: null,
    valueBool: null,
    valueNumber: null,
    valueText: null,
    note: null,
    evidenceCount: 0,
    attachments: [],
    status: "not_started",
    pointsEarned: 0,
    pointsPreview: 0,
    ...over,
  }) as RequirementView;

const hc10: CreditView = {
  projectCreditId: "pc",
  catalogCreditId: "cc",
  code: "HC-10",
  title: "Indoor Air Quality",
  categoryCode: "HC",
  categoryName: "Health and Comfort",
  isKeystone: false,
  pointsRaw: "3",
  aim: null,
  supportingGuidance: null,
  pageStart: 182,
  pageEnd: 185,
  status: "in_progress",
  pointsEarned: 0,
  pointsMax: 3,
  pointsMin: null,
  targeted: true,
  requirements: [
    req({
      seq: 1,
      evidenceSpecs: ["Specifications…", "IAQ Management Plan with all control measures…", "Completed IAQ Checklist…", "Flush-out report"],
      evidenceStages: ["design", "construction", "construction", "construction"],
      attachments: [
        file("spec", 0),
        file("plan", 1, "IAQ-Plan-rev2.pdf"),
        file("photo", 2, "Dust-screen-L2.jpg"),
        file("loose", null, "notes.txt"),
      ],
    }),
  ],
  additionalAttachments: [file("extra", null, "Approval.png")],
};

describe("inspection templates", () => {
  it("match a credit by what it is, not by its code", () => {
    expect(templateFor({ title: "Indoor Air Quality" })?.id).toBe("iaq-inspection");
    expect(templateFor({ title: "INDOOR AIR QUALITY" })?.id).toBe("iaq-inspection");
    expect(templateFor({ title: "Construction Environmental Management" })).toBeNull();
  });

  it("carry the team's items plus Moisture & Mold Control, numbered as the team numbers them", () => {
    const items = templateItems(IAQ_INSPECTION);
    expect(IAQ_INSPECTION.sections.map((s) => s.heading)).toEqual([
      "HVAC Protection",
      "Source Control",
      "Pathway Interruption",
      "Housekeeping",
      "Scheduling and Construction Activity Sequence",
      "Moisture & Mold Control",
    ]);
    expect(items.map((i) => i.no).slice(0, 8)).toEqual(["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "2.1"]);
    expect(items.find((i) => i.no === "5.2")?.text).toMatch(/^Coordinate construction activities/);
    expect(items.filter((i) => i.no.startsWith("6.")).length).toBeGreaterThanOrEqual(3);
    expect(items).toHaveLength(32);
  });
});

describe("planFileIds", () => {
  it("prefers files attached under the plan's own document slot", () => {
    expect(planFileIds(hc10, IAQ_INSPECTION.planDocument)).toEqual(["plan"]);
  });

  it("falls back to every file on the credit when none claims the plan slot", () => {
    const noPlan = { ...hc10, requirements: [req({ seq: 1, evidenceSpecs: ["A", "B"], attachments: [file("x", 0), file("y", null)] })] };
    expect(planFileIds(noPlan, IAQ_INSPECTION.planDocument)).toEqual(["x", "y", "extra"]);
  });
});

describe("normalizeCoverage", () => {
  const items = [
    { no: "2.5", text: "Keep containers of wet products closed" },
    { no: "1.1", text: "Filters at supply air intake" },
  ];
  const plan = "Section 4. Containers of paints,\n coatings and adhesives must be closed when not in use.";

  it("keeps a covered item only with a verbatim quote (whitespace and case aside)", () => {
    const out = normalizeCoverage(
      { items: [{ no: "2.5", covered: true, quote: "containers of paints, coatings and adhesives MUST be closed" }] },
      items,
      plan,
    );
    expect(out["2.5"].status).toBe("covered");
    expect(out["2.5"].quote).toMatch(/^containers of paints/);
    expect(out["1.1"]).toEqual({ status: "not_found", quote: null });
  });

  it("drops a fabricated quote, whatever the model claimed", () => {
    const out = normalizeCoverage(
      { items: [{ no: "1.1", covered: true, quote: "MERV 8 filters shall be fitted at all supply intakes." }] },
      items,
      plan,
    );
    expect(out["1.1"].status).toBe("not_found");
  });

  it("tolerates a bare array, missing items and junk", () => {
    expect(normalizeCoverage([{ no: "2.5", covered: true, quote: "must be closed when not in use" }], items, plan)["2.5"].status).toBe("covered");
    expect(normalizeCoverage(null, items, plan)["2.5"].status).toBe("not_found");
    expect(normalizeCoverage({ items: "nope" }, items, plan)["1.1"].status).toBe("not_found");
  });
});

describe("buildInspectionSheet", () => {
  const base = {
    template: IAQ_INSPECTION,
    credit: hc10,
    projectName: "Jeddah Central Oceanarium",
    ratingSystem: "Mostadam commercial D+C (2019)",
    stage: "construction" as const,
    generatedAt: "now",
  };

  it("slots the coverage read in per item and counts it", () => {
    const m = buildInspectionSheet({
      ...base,
      coverage: { ran: true, sources: ["IAQ-Plan-rev2.pdf"], byItem: { "2.5": { status: "covered", quote: "closed when not in use" } } },
    });
    const src = m.sections[1].items.find((i) => i.no === "2.5")!;
    expect(src.coverage).toEqual({ status: "covered", quote: "closed when not in use" });
    expect(m.sections[0].items[0].coverage).toEqual({ status: "not_found", quote: null });
    expect(m.coverage).toEqual({ ran: true, sources: ["IAQ-Plan-rev2.pdf"], covered: 1, total: 32 });
  });

  it("leaves the column empty, with the reason, when the read did not run", () => {
    const m = buildInspectionSheet({ ...base, coverage: { ran: false, reason: "no plan uploaded yet" } });
    expect(m.sections.every((s) => s.items.every((i) => i.coverage === null))).toBe(true);
    expect(m.coverage).toEqual({ ran: false, reason: "no plan uploaded yet" });
  });

  it("lists every photograph on the credit with where it was attached", () => {
    const m = buildInspectionSheet({ ...base, coverage: { ran: false, reason: "x" } });
    expect(m.photos.map((p) => [p.fileName, p.attachedTo])).toEqual([
      ["Dust-screen-L2.jpg", "Requirement #1 — Completed IAQ Checklist…"],
      ["Approval.png", "Additional attachment (credit level)"],
    ]);
    expect(m.project.stageLabel).toBe("Construction");
    expect(m.credit.pageSpan).toBe("pp.182–185");
  });

  it("is a construction-stage sheet even while the project is at design (client feedback)", () => {
    const m = buildInspectionSheet({ ...base, stage: "design", coverage: { ran: false, reason: "x" } });
    expect(m.project.stageLabel).toBe("Construction");
  });

  it("takes the stage from the catalog's tag, falling back to the project's when untagged", () => {
    expect(sheetStage(hc10, IAQ_INSPECTION.sheetDocument, "design")).toBe("Construction");
    const untagged = { ...hc10, requirements: [req({ seq: 1, evidenceSpecs: ["Completed IAQ Checklist"], evidenceStages: [null] })] };
    expect(sheetStage(untagged, IAQ_INSPECTION.sheetDocument, "design")).toBe("Design");
    const absent = { ...hc10, requirements: [] };
    expect(sheetStage(absent, IAQ_INSPECTION.sheetDocument, "construction")).toBe("Construction");
  });
});
