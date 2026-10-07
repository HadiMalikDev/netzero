import { describe, expect, it } from "vitest";
import type { CreditView, EvidenceAttachment } from "@/lib/data";
import { planFileIdsFor, suggestionFrom } from "@/lib/ai/inspection-draft";

const file = (id: string, idx: number | null): EvidenceAttachment => ({
  id,
  fileName: `${id}.pdf`,
  fileSize: 1,
  createdAt: 0,
  evidenceSpecIndex: idx,
  review: null,
});

const credit = (attachments: EvidenceAttachment[], extra: EvidenceAttachment[] = []) =>
  ({
    requirements: [
      {
        evidenceSpecs: ["Specifications…", "IAQ Management Plan with all control measures…", "Completed IAQ Checklist…"],
        attachments,
      },
    ],
    additionalAttachments: extra,
  }) as unknown as CreditView;

describe("suggestionFrom", () => {
  it("suggests Yes for covered, N/A for not applicable, nothing otherwise — never No", () => {
    expect(suggestionFrom({ status: "covered", quote: "q" })).toEqual({ answer: "yes", quote: "q" });
    expect(suggestionFrom({ status: "not_applicable", quote: "n" })).toEqual({ answer: "na", quote: "n" });
    expect(suggestionFrom({ status: "not_found", quote: null })).toEqual({ answer: null, quote: null });
    expect(suggestionFrom(undefined)).toEqual({ answer: null, quote: null });
  });

  it("never suggests Yes where Yes would assert a problem or an unknowable fact (ESC form)", () => {
    // "Is there any spill or leak at site?": a plan line about spill procedures
    // must not become "Yes, there is a spill".
    expect(suggestionFrom({ status: "covered", quote: "Spills shall be cleaned immediately." }, "no")).toEqual({ answer: null, quote: null });
    // "Is there any incidence of rain in the last 24 hours?": not a plan question.
    expect(suggestionFrom({ status: "covered", quote: "q" }, null)).toEqual({ answer: null, quote: null });
    // N/A is the same statement whichever way the question is phrased.
    expect(suggestionFrom({ status: "not_applicable", quote: "No silt curtain is installed." }, "no")).toEqual({
      answer: "na",
      quote: "No silt curtain is installed.",
    });
  });
});

describe("planFileIdsFor", () => {
  it("prefers files under the plan's document slot, matched as text, case aside", () => {
    expect(planFileIdsFor(credit([file("spec", 0), file("plan", 1), file("sheet", 2)]), "iaq management plan")).toEqual(["plan"]);
  });

  it("falls back to every file on the credit, then to none", () => {
    expect(planFileIdsFor(credit([file("spec", 0), file("loose", null)], [file("extra", null)]), "IAQ Management Plan")).toEqual([
      "spec",
      "loose",
      "extra",
    ]);
    expect(planFileIdsFor(credit([file("spec", 0)]), null)).toEqual(["spec"]);
    expect(planFileIdsFor(credit([]), "IAQ Management Plan")).toEqual([]);
  });
});
