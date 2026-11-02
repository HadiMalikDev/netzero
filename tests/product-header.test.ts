import { describe, expect, it } from "vitest";
import { normalizeHeader } from "@/lib/ai/product-header";

const types = [
  { id: "t-paint", heading: "Paints & Coatings" },
  { id: "t-floor", heading: "Carpet, Hard Flooring" },
];

describe("normalizeHeader (D46)", () => {
  it("keeps stated values, trimmed, and only material types on the list", () => {
    const r = normalizeHeader(
      {
        submittalRef: " JCD-OCN-MBL-PRO-MTS-0411 ",
        name: "Jotafloor  Easyflow\nPrimer HS",
        manufacturer: "Jotun",
        supplier: 42,
        countryOfOrigin: "Saudi Arabia",
        materialTypes: ["paints & coatings", "Ceilings", "Carpet, Hard Flooring", "Paints & Coatings"],
      },
      types,
    );
    expect(r).toEqual({
      submittalRef: "JCD-OCN-MBL-PRO-MTS-0411",
      name: "Jotafloor Easyflow Primer HS",
      locationOfUse: "",
      manufacturer: "Jotun",
      supplier: "",
      countryOfOrigin: "Saudi Arabia",
      typeIds: ["t-paint", "t-floor"],
    });
  });

  it("treats anything else as nothing read", () => {
    expect(normalizeHeader(null, types)).toMatchObject({ name: "", typeIds: [] });
    expect(normalizeHeader({ materialTypes: "Paints & Coatings", name: "x".repeat(500) }, types)).toMatchObject({ typeIds: [], name: "x".repeat(200) });
  });
});
