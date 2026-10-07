import { describe, expect, it } from "vitest";
import { normalizeCoverage } from "@/lib/ai/plan-coverage";

// The advisory plan read: a status is kept only with a quote that is verbatim
// in the plan (whitespace and case aside). Feeds the inspection AI draft.
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

  it("keeps N/A only when the plan says so in a verified quote", () => {
    const naPlan = "Scope. There is no demolition in this fit-out scope. Containers must be closed when not in use.";
    const naItems = [{ no: "1.3", text: "Seal diffusers during demolition" }, { no: "1.6", text: "Periodic duct inspections" }];
    const out = normalizeCoverage(
      {
        items: [
          { no: "1.3", status: "not_applicable", quote: "There is no demolition in this fit-out scope." },
          { no: "1.6", status: "not_applicable", quote: "Duct inspections are not required." },
        ],
      },
      naItems,
      naPlan,
    );
    expect(out["1.3"]).toEqual({ status: "not_applicable", quote: "There is no demolition in this fit-out scope." });
    expect(out["1.6"]).toEqual({ status: "not_found", quote: null }); // unverifiable
  });

  it("reads the new status shape for covered items too", () => {
    expect(
      normalizeCoverage({ items: [{ no: "2.5", status: "covered", quote: "must be closed when not in use" }] }, items, plan)["2.5"].status,
    ).toBe("covered");
    expect(normalizeCoverage({ items: [{ no: "2.5", status: "none", quote: "must be closed when not in use" }] }, items, plan)["2.5"].status).toBe("not_found");
  });

  it("tolerates a bare array, missing items and junk", () => {
    expect(normalizeCoverage([{ no: "2.5", covered: true, quote: "must be closed when not in use" }], items, plan)["2.5"].status).toBe("covered");
    expect(normalizeCoverage(null, items, plan)["2.5"].status).toBe("not_found");
    expect(normalizeCoverage({ items: "nope" }, items, plan)["1.1"].status).toBe("not_found");
  });
});
