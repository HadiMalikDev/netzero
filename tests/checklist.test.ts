import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CreditView, EvidenceAttachment, RequirementView } from "@/lib/data";
import {
  buildChecklist,
  creditPhotos,
  docState,
  formatValue,
  isImageFile,
  type ChecklistFile,
} from "@/lib/report/checklist";

const file = (
  id: string,
  evidenceSpecIndex: number | null,
  over: Partial<EvidenceAttachment> = {},
): EvidenceAttachment => ({
  id,
  fileName: `${id}.pdf`,
  fileSize: 1024,
  createdAt: 1_759_800_000,
  evidenceSpecIndex,
  review: null,
  ...over,
});

const review = (verdict: string, gaps: string[] = []): EvidenceAttachment["review"] => ({
  state: "done",
  verdict,
  summary: `summary for ${verdict}`,
  quotes: [],
  gaps,
  error: null,
});

const req = (over: Partial<RequirementView>): RequirementView =>
  ({
    entryId: `e${over.seq ?? 1}`,
    requirementId: `r${over.seq ?? 1}`,
    seq: 1,
    title: null,
    text: "Do the thing.",
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

const credit = (over: Partial<CreditView>): CreditView =>
  ({
    projectCreditId: "pc",
    catalogCreditId: "cc",
    code: "HC-10",
    title: "Indoor Air Quality",
    categoryCode: "HC",
    categoryName: "Health and Comfort",
    isKeystone: false,
    pointsRaw: "3",
    aim: "Enhance indoor air quality.",
    supportingGuidance: null,
    pageStart: 182,
    pageEnd: 185,
    status: "not_started",
    pointsEarned: 0,
    pointsMax: 3,
    pointsMin: null,
    targeted: true,
    requirements: [],
    additionalAttachments: [],
    ...over,
  }) as CreditView;

const build = (c: CreditView, stage: "design" | "construction" = "design") =>
  buildChecklist({
    projectName: "Jeddah Central Oceanarium",
    ratingSystem: "Mostadam commercial D+C (v1.0-2019)",
    stage,
    targetTier: "Gold",
    credit: c,
    generatedAt: "7 Oct 2026, 10:00",
  });

// HC-10 requirement 1 as the catalog holds it: one design document, three
// construction documents.
const hc10r1 = (attachments: EvidenceAttachment[], stage: "design" | "construction" = "design") =>
  req({
    seq: 1,
    title: "Indoor Air Quality (IAQ) Management Plan",
    text: "Develop and implement an IAQ Management Plan…",
    evidenceSpecs: ["Specifications…", "IAQ Management Plan…", "Completed IAQ Checklist…", "Report of flush-out…"],
    evidenceStages: ["design", "construction", "construction", "construction"],
    docGates: stage === "construction" ? [true, true, true, true] : [true, false, false, false],
    attachments,
  });

describe("docState", () => {
  const f = (verdict?: string): ChecklistFile => ({
    id: "f",
    fileName: "f.pdf",
    fileSize: 1,
    createdAt: 0,
    isImage: false,
    review: verdict
      ? { verdict, verdictLabel: "", summary: null, gaps: [] }
      : null,
  });

  it("is Missing when due with no file, Not due yet when not due", () => {
    expect(docState(true, [])).toBe("missing");
    expect(docState(false, [])).toBe("not_due");
  });

  it("is Provided only when a file is attached, whatever the review says", () => {
    expect(docState(true, [f()])).toBe("provided");
    expect(docState(true, [f("met")])).toBe("provided");
    expect(docState(true, [f("unclear")])).toBe("provided");
    // A file attached early, before it is due, still counts as provided.
    expect(docState(false, [f()])).toBe("provided");
  });

  it("flags gaps when any file's read is partially_met or not_met", () => {
    expect(docState(true, [f("partially_met")])).toBe("provided_with_gaps");
    expect(docState(true, [f("met"), f("not_met")])).toBe("provided_with_gaps");
  });

  it("an uncounted (optional, untouched) row is Not pursued, never Missing", () => {
    expect(docState(true, [], false)).toBe("not_pursued");
    expect(docState(false, [], false)).toBe("not_pursued");
    expect(docState(true, [f()], false)).toBe("provided");
  });
});

describe("formatValue", () => {
  it("words each metric type, and null when nothing is recorded", () => {
    expect(formatValue(req({ metricType: "BOOLEAN", valueBool: true }))).toBe("Yes");
    expect(formatValue(req({ metricType: "BOOLEAN", valueBool: false }))).toBe("No");
    expect(formatValue(req({ metricType: "BOOLEAN" }))).toBeNull();
    expect(formatValue(req({ metricType: "NUMERIC", valueNumber: 42, unit: "%" }))).toBe("42 %");
    expect(formatValue(req({ metricType: "NUMERIC", valueNumber: 2 }))).toBe("2");
    expect(formatValue(req({ metricType: "DESCRIPTIVE", valueText: "  Plan issued " }))).toBe("Plan issued");
    expect(formatValue(req({ metricType: "DESCRIPTIVE", valueText: "  " }))).toBeNull();
  });
});

describe("isImageFile", () => {
  it("takes PNG and JPEG only", () => {
    expect(isImageFile("Site-Photo.png")).toBe(true);
    expect(isImageFile("site.JPG")).toBe(true);
    expect(isImageFile("site.jpeg")).toBe(true);
    expect(isImageFile("site.webp")).toBe(false);
    expect(isImageFile("plan.pdf")).toBe(false);
    expect(isImageFile("noext")).toBe(false);
  });
});

describe("buildChecklist — documents and stage", () => {
  it("at design stage, construction documents read Not due yet and the design one Missing", () => {
    const m = build(credit({ requirements: [hc10r1([])] }));
    const block = m.sections[0];
    if (block.kind !== "requirement") throw new Error("expected a requirement");
    expect(block.block.docs.map((d) => d.state)).toEqual(["missing", "not_due", "not_due", "not_due"]);
    expect(m.summary).toEqual({ listed: 4, due: 1, provided: 0, withGaps: 0, missing: 1 });
  });

  it("a file against a document makes it Provided; the AI read is carried, not used for state", () => {
    const m = build(
      credit({
        requirements: [
          hc10r1([
            file("plan", 1, { review: review("partially_met", ["No flush-out schedule."]) }),
            file("spec", 0, { review: review("met") }),
          ]),
        ],
      }),
    );
    const block = m.sections[0];
    if (block.kind !== "requirement") throw new Error("expected a requirement");
    const [spec, plan] = block.block.docs;
    expect(spec.state).toBe("provided");
    expect(spec.files[0].review?.verdictLabel).toBe("Appears to meet");
    expect(plan.state).toBe("provided_with_gaps");
    expect(plan.files[0].review?.gaps).toEqual(["No flush-out schedule."]);
    expect(m.summary).toEqual({ listed: 4, due: 1, provided: 2, withGaps: 1, missing: 0 });
  });

  it("at construction stage every listed document is due", () => {
    const m = build(credit({ requirements: [hc10r1([], "construction")] }), "construction");
    const block = m.sections[0];
    if (block.kind !== "requirement") throw new Error("expected a requirement");
    expect(block.block.docs.every((d) => d.due && d.state === "missing")).toBe(true);
    expect(m.project.stageLabel).toBe("Construction");
    expect(m.summary.due).toBe(4);
  });

  it("a pending or failed AI read is not reported", () => {
    const m = build(
      credit({
        requirements: [
          hc10r1([
            file("a", 0, { review: { state: "pending", verdict: null, summary: null, quotes: [], gaps: [], error: null } }),
          ]),
        ],
      }),
    );
    const block = m.sections[0];
    if (block.kind !== "requirement") throw new Error("expected a requirement");
    expect(block.block.docs[0].state).toBe("provided");
    expect(block.block.docs[0].files[0].review).toBeNull();
  });

  it("a file with no slot, or a slot past the list, is an other file and ticks nothing", () => {
    const m = build(credit({ requirements: [hc10r1([file("x", null), file("y", 9)])] }));
    const block = m.sections[0];
    if (block.kind !== "requirement") throw new Error("expected a requirement");
    expect(block.block.docs.every((d) => d.files.length === 0)).toBe(true);
    expect(block.block.otherFiles.map((f) => f.id)).toEqual(["x", "y"]);
    expect(m.summary.provided).toBe(0);
  });
});

describe("buildChecklist — photographs", () => {
  it("collects PNG/JPEG files from documents, other files and credit-level attachments, in that order", () => {
    const m = build(
      credit({
        requirements: [
          hc10r1([
            file("doc-photo", 2, { fileName: "Site-Photo.png" }),
            file("doc-pdf", 1, { fileName: "Plan.pdf" }),
            file("other-photo", null, { fileName: "Dust-screen.jpg" }),
          ]),
        ],
        additionalAttachments: [file("extra", null, { fileName: "Approval.jpeg" }), file("extra-pdf", null)],
      }),
    );
    expect(m.photos.map((p) => p.fileId)).toEqual(["doc-photo", "other-photo", "extra"]);
    expect(m.photos[0].attachedTo).toBe("Requirement #1 — Completed IAQ Checklist…");
    expect(m.photos[1].attachedTo).toBe("Requirement #1 — other file");
    expect(m.photos[2].attachedTo).toBe("Additional attachment (credit level)");
    expect(m.additionalFiles).toHaveLength(2);
  });
});

describe("buildChecklist — either/or and optional rows", () => {
  const xor = (planned: [boolean, boolean]) => [
    req({ seq: 1, title: "Prescriptive Option", optionGroup: "E-01 options", planned: planned[0], evidenceSpecs: ["Prescriptive Energy Tool"], evidenceStages: ["design"], docGates: [true] }),
    req({ seq: 2, title: "Performance Option", optionGroup: "E-01 options", planned: planned[1], evidenceSpecs: ["Energy model report"], evidenceStages: ["design"], docGates: [true] }),
  ];

  it("with no path picked, the group is one choose step and nothing is counted", () => {
    const m = build(credit({ code: "E-01", requirements: xor([true, true]) }));
    expect(m.sections).toHaveLength(1);
    expect(m.sections[0].kind).toBe("choose");
    if (m.sections[0].kind === "choose")
      expect(m.sections[0].choose.options.map((o) => o.title)).toEqual(["Prescriptive Option", "Performance Option"]);
    expect(m.summary.listed).toBe(0);
    expect(m.setAside).toEqual([]);
  });

  it("once picked, only the chosen path's documents are listed and the other is set aside", () => {
    const m = build(credit({ code: "E-01", requirements: xor([false, true]) }));
    expect(m.sections).toHaveLength(1);
    const s = m.sections[0];
    if (s.kind !== "requirement") throw new Error("expected a requirement");
    expect(s.block.seq).toBe(2);
    expect(s.block.tag).toBe("pursuing");
    expect(m.setAside.map((r) => r.seq)).toEqual([1]);
    expect(m.summary).toEqual({ listed: 1, due: 1, provided: 0, withGaps: 0, missing: 1 });
  });

  it("an untouched optional row is listed but not counted", () => {
    const m = build(
      credit({
        requirements: [
          req({ seq: 1, evidenceSpecs: ["A"], evidenceStages: ["design"], docGates: [true] }),
          req({ seq: 2, optional: true, evidenceSpecs: ["B"], evidenceStages: ["design"], docGates: [true] }),
        ],
      }),
    );
    expect(m.sections).toHaveLength(2);
    const second = m.sections[1];
    if (second.kind !== "requirement") throw new Error("expected a requirement");
    expect(second.block.tag).toBe("optional");
    expect(second.block.counted).toBe(false);
    expect(second.block.docs[0].state).toBe("not_pursued");
    expect(m.summary.listed).toBe(1);
  });
});

describe("buildChecklist — header and guidance", () => {
  it("carries the project, credit, points span, page span and wording", () => {
    const m = build(
      credit({
        status: "in_progress",
        pointsEarned: 1,
        requirements: [req({ seq: 1, status: "completed", valueBool: true, note: " Plan issued to site. " })],
      }),
    );
    expect(m.project.name).toBe("Jeddah Central Oceanarium");
    expect(m.project.targetTier).toBe("Gold");
    expect(m.credit.statusLabel).toBe("In Progress");
    expect(m.credit.pointsAvailable).toBe("3");
    expect(m.credit.pageSpan).toBe("pp.182–185");
    const s = m.sections[0];
    if (s.kind !== "requirement") throw new Error("expected a requirement");
    expect(s.block.statusLabel).toBe("Completed");
    expect(s.block.value).toBe("Yes");
    expect(s.block.note).toBe("Plan issued to site.");
  });

  it("lists what the manual requires from the stored guidance, and nothing when it has no list", () => {
    const withLists = build(
      credit({ supportingGuidance: readFileSync("tests/fixtures/guidance-hc10.txt", "utf8") }),
    );
    expect(withLists.guidance[0].items.map((i) => i.text)).toContain("Housekeeping");
    expect(build(credit({ supportingGuidance: "Prose only. No list." })).guidance).toEqual([]);
    expect(build(credit({ supportingGuidance: null })).guidance).toEqual([]);
  });
});

describe("creditPhotos — the inspection sheet's photos follow the path being pursued", () => {
  const img = (id: string, idx: number | null) => file(id, idx, { fileName: `${id}.png` });
  const xor = (planned: [boolean, boolean]) => [
    req({ seq: 1, title: "Option A", optionGroup: "g", planned: planned[0], evidenceSpecs: ["A doc"], attachments: [img("a-photo", 0)] }),
    req({ seq: 2, title: "Option B", optionGroup: "g", planned: planned[1], evidenceSpecs: ["B doc"], attachments: [img("b-photo", 0)] }),
    req({ seq: 3, optional: true, evidenceSpecs: ["Opt doc"], attachments: [img("opt-photo", 0), img("loose", null)] }),
  ];
  const ids = (c: CreditView) => creditPhotos(c).map((p) => p.fileId);

  it("leaves out photos on the option set aside, keeps the chosen one, optional rows and credit-level files", () => {
    expect(ids(credit({ requirements: xor([false, true]), additionalAttachments: [img("extra", null)] }))).toEqual([
      "b-photo",
      "opt-photo",
      "loose",
      "extra",
    ]);
  });

  it("leaves out both options' photos while no path is chosen", () => {
    expect(ids(credit({ requirements: xor([true, true]) }))).toEqual(["opt-photo", "loose"]);
  });

  it("agrees with the compliance checklist's photos", () => {
    for (const planned of [[false, true], [true, false], [true, true]] as [boolean, boolean][]) {
      const c = credit({ requirements: xor(planned), additionalAttachments: [img("extra", null)] });
      expect(ids(c).sort()).toEqual(build(c).photos.map((p) => p.fileId).sort());
    }
  });
});
