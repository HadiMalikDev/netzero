import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import type { CreditView, EvidenceAttachment } from "@/lib/data";
import type { InspectionDetail, ResponseRow } from "@/lib/checklists";
import { InspectionSheet } from "@/lib/pdf/InspectionSheet";
import { registerPdfHyphenation } from "@/lib/pdf/shared";
import { buildInspectionSheet, formatInspectionDate, sheetStage } from "@/lib/report/inspection-sheet";

registerPdfHyphenation();

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const photo: EvidenceAttachment = {
  id: "photo",
  fileName: "Dust-screen.png",
  fileSize: 70,
  createdAt: 1_759_800_000,
  evidenceSpecIndex: 2,
  review: null,
};

const credit = {
  projectCreditId: "pc",
  code: "HC-10",
  title: "Indoor Air Quality",
  pageStart: 182,
  pageEnd: 185,
  requirements: [
    {
      seq: 1,
      evidenceSpecs: ["Specifications…", "IAQ Management Plan…", "Completed IAQ Checklist of all regular inspections…"],
      evidenceStages: ["design", "construction", "construction"],
      attachments: [photo],
    },
  ],
  additionalAttachments: [],
} as unknown as CreditView;

const r = (itemNo: string, sectionNo: string, sectionHeading: string, itemText: string, over: Partial<ResponseRow> = {}): ResponseRow => ({
  id: itemNo,
  itemNo,
  sectionNo,
  sectionHeading,
  itemText,
  aiAnswer: null,
  aiQuote: null,
  answer: null,
  remark: null,
  ...over,
});

const inspection: InspectionDetail = {
  id: "i",
  templateId: "t",
  projectCreditId: "pc",
  inspectionDate: "2026-10-08",
  inspector: "Site IAQ Coordinator",
  area: "Level 2",
  aiState: "done",
  aiNote: "[]",
  reviewedAt: 1_759_900_000,
  reviewedByName: "Admin",
  createdAt: 1_759_800_000,
  template: {
    id: "t",
    projectCreditId: "pc",
    creditTitle: "Indoor Air Quality",
    title: "Construction Indoor Air Quality Inspection",
    confirmation: "I confirm the checked activities to be proceeding according to the plan.",
    planDocument: "IAQ Management Plan",
    sheetDocument: "Completed IAQ Checklist",
  },
  responses: [
    r("1.1", "1", "HVAC Protection", "Filters at supply air intake", { aiAnswer: "yes", answer: "yes" }),
    r("1.2", "1", "HVAC Protection", "Filters at return air openings", { aiAnswer: "yes", answer: "no", remark: "Filters missing on AHU-3" }),
    r("1.3", "1", "HVAC Protection", "Seal diffusers during demolition", { aiAnswer: "na", aiQuote: "No demolition.", answer: "na" }),
    r("2.1", "2", "Source Control", "Low/no VOC products", { answer: "na", remark: "None used yet" }),
    r("2.2", "2", "Source Control", "Prohibit idling"),
  ],
};

const model = (over: Partial<Parameters<typeof buildInspectionSheet>[0]> = {}) =>
  buildInspectionSheet({
    inspection,
    credit,
    projectName: "Jeddah Central Oceanarium",
    ratingSystem: "Mostadam commercial D+C (2019)",
    projectStage: "design",
    generatedAt: "now",
    reviewedOn: "8 Oct 2026",
    ...over,
  });

describe("buildInspectionSheet", () => {
  it("groups the saved answers under their headings, in order", () => {
    const m = model();
    expect(m.sections.map((s) => [s.no, s.heading, s.items.length])).toEqual([
      ["1", "HVAC Protection", 3],
      ["2", "Source Control", 2],
    ]);
    expect(m.sections[0].items[1]).toEqual({ no: "1.2", text: "Filters at return air openings", answer: "no", remark: "Filters missing on AHU-3" });
  });

  it("carries the header and reviewer, and is a construction-stage sheet while the project is at design", () => {
    const m = model();
    expect(m.inspection).toEqual({ date: "8 Oct 2026", inspector: "Site IAQ Coordinator", area: "Level 2" });
    expect(m.reviewed).toEqual({ by: "Admin", on: "8 Oct 2026" });
    expect(m.project.stageLabel).toBe("Construction");
    expect(m.photos.map((p) => p.attachedTo)).toEqual(["Requirement #1 — Completed IAQ Checklist of all regular inspections…"]);
  });
});

describe("sheetStage and formatInspectionDate", () => {
  it("takes the stage from the catalog tag on the sheet's document, else the project's", () => {
    expect(sheetStage(credit, "completed iaq checklist", "design")).toBe("Construction");
    expect(sheetStage(credit, "Not a listed document", "design")).toBe("Design");
    expect(sheetStage(credit, null, "construction")).toBe("Construction");
  });

  it("prints ISO dates as the team writes them", () => {
    expect(formatInspectionDate("2026-07-23")).toBe("23 Jul 2026");
    expect(formatInspectionDate(null)).toBeNull();
    expect(formatInspectionDate("last week")).toBe("last week");
  });
});

async function textOf(buf: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: text.replace(/\s+/g, " "), pages: totalPages };
}

describe("InspectionSheet PDF", () => {
  it("prints the reviewer's answers in Yes / No / Remarks, N/A in Remarks, and no AI column", async () => {
    const buf = await renderToBuffer(InspectionSheet({ model: model(), images: new Map([["photo", { data: PNG_1x1, format: "png" }]]) }));
    const { text, pages } = await textOf(buf);
    expect(pages).toBe(2);
    expect(text).toContain("Construction Indoor Air Quality Inspection");
    expect(text).toContain("Construction stage");
    expect(text).toMatch(/Inspection date 8 Oct 2026 Inspector Site IAQ Coordinator Area \/ level Level 2/);
    expect(text).toMatch(/No Description Yes No Remarks 1 HVAC Protection/);
    expect(text).toContain("1.1 Filters at supply air intake YES");
    expect(text).toContain("1.2 Filters at return air openings NO Filters missing on AHU-3");
    expect(text).toContain("1.3 Seal diffusers during demolition N/A");
    expect(text).toContain("2.1 Low/no VOC products N/A · None used yet");
    expect(text).toContain("Responses reviewed by Admin on 8 Oct 2026.");
    expect(text).toContain("Signature");
    expect(text).not.toMatch(/\bAI\b|In uploaded plan|No demolition/);
    expect(text).toContain("Dust-screen.png");
  });

  it("renders with no photographs on one page", async () => {
    const bare = { ...credit, requirements: [{ ...credit.requirements[0], attachments: [] }] } as unknown as CreditView;
    const { text, pages } = await textOf(await renderToBuffer(InspectionSheet({ model: model({ credit: bare }), images: new Map() })));
    expect(pages).toBe(1);
    expect(text).toContain("No PNG or JPEG files are attached to this credit yet");
  });
});
