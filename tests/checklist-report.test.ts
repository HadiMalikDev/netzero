import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import type { CreditView, EvidenceAttachment, RequirementView } from "@/lib/data";
import { buildChecklist } from "@/lib/report/checklist";
import { ChecklistReport, type ImageBytes } from "@/lib/pdf/ChecklistReport";
import { registerPdfHyphenation } from "@/lib/pdf/shared";

registerPdfHyphenation();

// A 1×1 red PNG — enough to exercise the Image path without a fixture file.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const file = (id: string, idx: number | null, over: Partial<EvidenceAttachment> = {}): EvidenceAttachment => ({
  id,
  fileName: `${id}.pdf`,
  fileSize: 2048,
  createdAt: 1_759_800_000,
  evidenceSpecIndex: idx,
  review: null,
  ...over,
});

const req = (over: Partial<RequirementView>): RequirementView =>
  ({
    entryId: `e${over.seq}`,
    requirementId: `r${over.seq}`,
    title: null,
    text: "Requirement text.",
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

// HC-10 with every state present: Provided (met), Provided with gaps, Missing,
// Not due yet; a photo against a document; an unassigned file; a set-aside
// either/or pair; a credit-level file; the real stored guidance; and a ≤ to
// exercise the WinAnsi filter.
const credit: CreditView = {
  projectCreditId: "pc",
  catalogCreditId: "cc",
  code: "HC-10",
  title: "Indoor Air Quality",
  categoryCode: "HC",
  categoryName: "Health and Comfort",
  isKeystone: false,
  pointsRaw: "3",
  aim: "Enhance indoor air quality (TVOC ≤ 500 µg/m3).",
  supportingGuidance: readFileSync("tests/fixtures/guidance-hc10.txt", "utf8"),
  pageStart: 182,
  pageEnd: 185,
  status: "in_progress",
  pointsEarned: 1,
  pointsMax: 3,
  pointsMin: null,
  targeted: true,
  requirements: [
    req({
      seq: 1,
      title: "Indoor Air Quality (IAQ) Management Plan",
      text: "Develop and implement an IAQ Management Plan during construction stage.",
      status: "completed",
      valueBool: true,
      note: "Plan issued to site 2 Oct.",
      evidenceSpecs: ["Specifications requiring an IAQ plan", "IAQ Management Plan", "Completed IAQ Checklist with photos", "Flush-out report"],
      evidenceStages: ["design", "construction", "construction", "construction"],
      docGates: [true, true, true, true],
      attachments: [
        file("spec", 0, { review: { state: "done", verdict: "met", summary: "The spec requires an IAQ plan.", quotes: [], gaps: [], error: null } }),
        file("plan", 1, { review: { state: "done", verdict: "partially_met", summary: "Covers five measures.", quotes: [], gaps: ["No Moisture & Mold Control section."], error: null } }),
        file("photo", 2, { fileName: "Site-Photo-Dust-Screen.png", fileSize: 70 }),
        file("loose", null, { fileName: "Toolbox-talk.txt" }),
      ],
    }),
    req({
      seq: 2,
      title: "IAQ Testing",
      text: "A specialist contractor conducts IAQ testing prior to occupancy.",
      metricType: "NUMERIC",
      unit: "µg/m3",
      evidenceSpecs: ["IAQ test report", "Testing agency profile"],
      evidenceStages: ["construction", "construction"],
      docGates: [false, false],
    }),
    req({ seq: 3, title: "Option A", optionGroup: "g", planned: false, evidenceSpecs: ["A doc"], evidenceStages: [null], docGates: [true] }),
    req({ seq: 4, title: "Option B", optionGroup: "g", planned: true, evidenceSpecs: ["B doc"], evidenceStages: [null], docGates: [true] }),
  ],
  additionalAttachments: [file("approval", null, { fileName: "Approval-letter.pdf" })],
};

const model = buildChecklist({
  projectName: "Jeddah Central Oceanarium",
  ratingSystem: "Mostadam commercial D+C (v1.0-2019)",
  stage: "design",
  targetTier: "Gold",
  credit,
  generatedAt: "7 Oct 2026, 10:00",
});

async function textOf(buf: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: text.replace(/\s+/g, " "), pages: totalPages };
}

describe("ChecklistReport", () => {
  it("renders a model with every state present, embedding the photo", async () => {
    const images: ImageBytes = new Map([["photo", { data: PNG_1x1, format: "png" }]]);
    const buf = await renderToBuffer(ChecklistReport({ model, images }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const { text, pages } = await textOf(buf);
    expect(pages).toBeGreaterThanOrEqual(2);

    // Header and provenance. (Uppercase labels come back uppercased from the extractor.)
    expect(text).toMatch(/compliance checklist/i);
    expect(text).toContain("HC-10 — Indoor Air Quality");
    expect(text).toContain("Jeddah Central Oceanarium");
    expect(text).toContain("Nothing on this document was typed in by hand");
    expect(text).toContain("TVOC <= 500"); // ≤ mapped, not crashed

    // Every document state is worded.
    expect(text).toContain("Provided — AI read found gaps");
    expect(text).toContain("Missing");
    expect(text).toContain("Not due yet");
    expect(text).toMatch(/appears to meet/i);
    expect(text).toMatch(/partially meets/i);
    expect(text).toContain("No Moisture & Mold Control section.");

    // Recorded value and note.
    expect(text).toContain("Recorded value Yes");
    expect(text).toContain("Plan issued to site 2 Oct.");

    // Unassigned and credit-level files are listed, set-aside option named.
    expect(text).toContain("Toolbox-talk.txt");
    expect(text).toContain("Approval-letter.pdf");
    expect(text).toContain("set aside");
    expect(text).toContain("#3 Option A");

    // Photo section and the manual's list.
    expect(text).toContain("Photographs");
    expect(text).toContain("Site-Photo-Dust-Screen.png");
    expect(text).toContain("What the manual requires the plan to contain");
    expect(text).toContain("Moisture & Mold Control");
    expect(text).toContain("Scheduling");
  });

  it("still renders when an image could not be read", async () => {
    const buf = await renderToBuffer(ChecklistReport({ model, images: new Map() }));
    const { text } = await textOf(buf);
    expect(text).toContain("[image could not be read]");
    expect(text).toContain("Site-Photo-Dust-Screen.png");
  });

  it("renders a bare credit: no files, no guidance list, no photos", async () => {
    const bare = buildChecklist({
      projectName: "P",
      ratingSystem: "R",
      stage: "construction",
      targetTier: null,
      credit: { ...credit, supportingGuidance: "Prose only.", additionalAttachments: [], requirements: [req({ seq: 1, text: "Only requirement." })] },
      generatedAt: "now",
    });
    const buf = await renderToBuffer(ChecklistReport({ model: bare, images: new Map() }));
    const { text, pages } = await textOf(buf);
    expect(pages).toBe(1);
    expect(text).toContain("The manual lists no specific documents for this requirement");
    expect(text).not.toContain("Photographs");
    expect(text).not.toContain("What the manual requires");
    expect(text).toMatch(/target level not set/i);
  });
});
