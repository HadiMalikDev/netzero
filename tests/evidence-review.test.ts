import { describe, expect, it } from "vitest";
import { normalizeReview, VERDICTS } from "@/lib/ai/evidence-review";

describe("normalizeReview", () => {
  it("keeps a well-formed result", () => {
    const r = normalizeReview({
      verdict: "partially_met",
      summary: "The plan covers accommodation but not grievance handling.",
      quotes: ["Workers are housed in air-conditioned units."],
      gaps: ["Maintenance and inspection logs"],
    });
    expect(r.verdict).toBe("partially_met");
    expect(r.quotes).toHaveLength(1);
    expect(r.gaps).toEqual(["Maintenance and inspection logs"]);
  });

  it("accepts the spacing and casing a model may drift into", () => {
    expect(normalizeReview({ verdict: "Partially Met" }).verdict).toBe(
      "partially_met",
    );
    expect(normalizeReview({ verdict: "NOT-MET" }).verdict).toBe("not_met");
  });

  it("falls back to unclear rather than inventing a verdict", () => {
    // A model that answers "probably fine" must not be read as "met".
    expect(normalizeReview({ verdict: "probably fine" }).verdict).toBe("unclear");
    expect(normalizeReview({}).verdict).toBe("unclear");
    expect(normalizeReview(null).verdict).toBe("unclear");
  });

  it("never lets the model claim a document is unreadable", () => {
    // "unreadable" is the extractor's call, not the model's.
    expect(normalizeReview({ verdict: "unreadable" }).verdict).toBe("unclear");
  });

  it("survives quotes and gaps of the wrong shape", () => {
    const r = normalizeReview({ verdict: "met", quotes: "not an array", gaps: 7 });
    expect(r.quotes).toEqual([]);
    expect(r.gaps).toEqual([]);
  });

  it("caps runaway output", () => {
    const r = normalizeReview({
      verdict: "met",
      summary: "x".repeat(5000),
      quotes: Array.from({ length: 40 }, () => "y".repeat(1000)),
    });
    expect(r.summary.length).toBe(600);
    expect(r.quotes).toHaveLength(8);
    expect(r.quotes[0].length).toBe(200);
  });

  it("exposes exactly the verdicts the UI can render", () => {
    expect([...VERDICTS]).toEqual([
      "met",
      "partially_met",
      "not_met",
      "unclear",
      "unreadable",
    ]);
  });
});
