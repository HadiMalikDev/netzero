import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import type { CreditView } from "@/lib/data";
import { InspectionSheet } from "@/lib/pdf/InspectionSheet";
import { registerPdfHyphenation } from "@/lib/pdf/shared";
import { buildInspectionSheet } from "@/lib/report/inspection-sheet";
import { IAQ_INSPECTION } from "@/lib/report/inspection-template";

registerPdfHyphenation();

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const credit = {
  code: "HC-10",
  title: "Indoor Air Quality",
  pageStart: 182,
  pageEnd: 185,
  requirements: [
    {
      seq: 1,
      evidenceSpecs: ["Spec", "IAQ Management Plan", "Completed IAQ Checklist"],
      evidenceStages: ["design", "construction", "construction"],
      attachments: [
        { id: "photo", fileName: "Dust-screen.png", fileSize: 70, createdAt: 1_759_800_000, evidenceSpecIndex: 2, review: null },
      ],
    },
  ],
  additionalAttachments: [],
} as unknown as CreditView;

async function textOf(buf: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: text.replace(/\s+/g, " "), pages: totalPages };
}

describe("InspectionSheet", () => {
  it("renders the team's table with the advisory column filled and the photo table", async () => {
    const model = buildInspectionSheet({
      template: IAQ_INSPECTION,
      credit,
      projectName: "Jeddah Central Oceanarium",
      ratingSystem: "Mostadam commercial D+C (2019)",
      stage: "construction",
      generatedAt: "7 Oct 2026, 10:00",
      coverage: {
        ran: true,
        sources: ["IAQ-Plan.pdf"],
        byItem: { "2.5": { status: "covered", quote: "Containers must be closed when not in use." } },
      },
    });
    const buf = await renderToBuffer(InspectionSheet({ model, images: new Map([["photo", { data: PNG_1x1, format: "png" }]]) }));
    const { text, pages } = await textOf(buf);
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(text).toContain("Construction Indoor Air Quality Inspection");
    expect(text).toMatch(/No Description Yes No Remarks In uploaded plan \(AI\) · 1\/32/);
    expect(text).toContain("1 HVAC Protection");
    expect(text).toContain("1.1 Filters at supply air intake");
    expect(text).toContain("6 Moisture & Mold Control");
    expect(text).toContain("Containers must be closed when not in use.");
    expect(text).toContain("not found");
    expect(text).toContain("I confirm the checked activities");
    expect(text).toContain("Signature");
    expect(text).toContain("Dust-screen.png");
    expect(text).toContain("Requirement #1 — Completed IAQ Checklist");
    // The Yes / No / Remarks cells carry nothing from the app.
    expect(text).not.toMatch(/\bYES\b/);
  });

  it("renders with the read not run and no photographs", async () => {
    const model = buildInspectionSheet({
      template: IAQ_INSPECTION,
      credit: { ...credit, requirements: [], additionalAttachments: [] } as unknown as CreditView,
      projectName: "P",
      ratingSystem: "R",
      stage: "design",
      generatedAt: "now",
      coverage: { ran: false, reason: "no plan uploaded yet" },
    });
    const buf = await renderToBuffer(InspectionSheet({ model, images: new Map() }));
    const { text } = await textOf(buf);
    expect(text).toContain("not run — no plan uploaded yet");
    expect(text).toContain("No PNG or JPEG files are attached to this credit yet");
  });
});
