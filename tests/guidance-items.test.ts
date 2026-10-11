import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countItems, guidanceLists } from "@/lib/report/guidance-items";

// The stored supporting-guidance strings of real credits, exactly as the parser
// flattens them (tests/fixtures/guidance-*.txt, written from the Commercial D+C
// manual on 2026-10-07). The checklist PDF prints these rows, so they must come
// out exactly or not at all.
const fixture = (name: string) =>
  readFileSync(`tests/fixtures/guidance-${name}.txt`, "utf8");

describe("guidanceLists — HC-10 Indoor Air Quality", () => {
  const lists = guidanceLists(fixture("hc10"));

  it("finds the six SMACNA control measures as one list", () => {
    expect(lists[0].items.map((i) => i.text)).toEqual([
      "HVAC Protection",
      "Source Control",
      "Moisture & Mold Control",
      "Pathway Interruption",
      "Housekeeping",
      "Scheduling",
    ]);
    expect(lists[0].intro).toMatch(/^The IAQ Management Plan must include control measures/);
    expect(lists[0].intro).toMatch(/at a minimum:$/);
  });

  it("cuts the manual's prose off the last label (not 'Scheduling The Plan must…')", () => {
    expect(lists[0].items[5].text).toBe("Scheduling");
  });

  it("opens a second list at 'Indoor Air Quality Testing:' with the page number stripped", () => {
    expect(lists).toHaveLength(2);
    expect(lists[1].heading).toBe("Indoor Air Quality Testing");
    expect(lists[1].items).toHaveLength(4); // a) to d)
    expect(lists[1].items[0].text).not.toMatch(/\b182\b/);
  });

  it("nests `o` sub-bullets as siblings under their lettered item", () => {
    const c = lists[1].items[2];
    expect(c.text).toBe("Air sample testing shall be conducted as follows:");
    expect(c.children.map((i) => i.text.slice(0, 20))).toEqual([
      "All interior finishe",
      "Air samples must be ",
      "The number of sampli",
    ]);
    expect(c.children.every((i) => i.children.length === 0)).toBe(true);
  });

  it("keeps an in-sentence number ('2 Air Changes') out of the page-number rule", () => {
    // The flush-out paragraph is prose, not a list; but the rule that strips
    // "182" must not also eat the "2" in "equals 2 Air Changes per Hour".
    const lastLabel = lists[0].items[5];
    expect(lastLabel.text).toBe("Scheduling");
    expect(fixture("hc10")).toContain("equals 2 Air Changes");
  });
});

describe("guidanceLists — SS-03 Construction Environmental Management", () => {
  const lists = guidanceLists(fixture("ss03"));

  it("finds the CEMP's seven sections a) to g) under their heading", () => {
    expect(lists[0].heading).toBe("Construction Environmental Management Plan");
    expect(lists[0].intro).toBe("The CEMP must include the following as a minimum:");
    expect(lists[0].items.map((i) => i.text)).toEqual([
      "Comprehensive Environmental Impact Assessment (EIA)",
      "Construction dust control plan",
      "Construction noise pollution monitoring plan",
      "Construction waste management plan",
      "Energy and water consumption reduction plan",
      "Site Audit Plan",
      "Construction materials’ transportation and procurement plan",
    ]);
  });

  it("keeps bullets under their section and sub-bullets under their bullet", () => {
    const dust = lists[0].items[1];
    expect(dust.children.map((i) => i.text)).toEqual([
      "Perform onsite measurement of particulate matter (PM) in the air during peak construction activity.",
      "Particulate matter limits must follow National Ambient Air Quality Standards (NAAQS) from the Environmental Protection Agency.",
      "Isolate dust-producing activities.",
    ]);
    const audit = lists[0].items[5];
    expect(audit.children).toHaveLength(2);
    expect(audit.children[1].children.map((i) => i.text)).toEqual([
      "Date-stamped photographs",
      "An update on all priority CEMP plans: dust control, noise control, non-hazardous and hazardous waste management, and energy and water conservation",
      "Responses to observed deviations from the CEMP with mitigation and remediation measures",
      "Verification that all mitigation and remediation measures have been implemented",
    ]);
  });

  it("does not cut an interior bullet that has two sentences", () => {
    const report = lists[0].items[5].children[1];
    expect(report.text).toBe(
      "A report is to be produced following each site audit. The site audit report must include:",
    );
  });

  it("drops the page number between 'controls.' and the next sub-bullet", () => {
    const energy = lists[0].items[4].children[0];
    expect(energy.children.map((i) => i.text).join(" ")).not.toMatch(/\b41\b/);
    expect(energy.children[1].text).toMatch(/^Workers living within a 25km radius/);
  });

  it("starts a new list at 'Environmental Professional:' after a sentence end", () => {
    expect(lists).toHaveLength(2);
    expect(lists[1].heading).toBe("Environmental Professional");
    expect(lists[1].intro).toMatch(/has achieved the following:$/);
    expect(lists[1].items).toHaveLength(2);
    // The section before it ends at its own sentence, not at the heading.
    const g = lists[0].items[6].children[0];
    expect(g.text).toMatch(/\(GCC\) area\.$/);
  });

  it("cuts the closing prose off the last bullet at its sentence end", () => {
    expect(lists[1].items[1].text).toMatch(/mitigation measures\.$/);
    expect(lists[1].items[1].text).not.toContain("does not need to be an independent third party");
  });

  it("counts every row at every depth", () => {
    expect(countItems(lists)).toBe(38);
  });
});

describe("guidanceLists — other shapes", () => {
  it("E-01: a bullet list, a lettered list under a heading that ends the prose, and a third list", () => {
    const lists = guidanceLists(fixture("e01"));
    expect(lists.map((l) => l.heading)).toEqual([
      "Performance Option",
      "Additional Clarifications",
      "Preliminary Energy Model",
    ]);
    // The glued "The total annual energy consumption…" prose is cut off the last bullet.
    expect(lists[0].items[1].text).toBe(
      "Proposed building based on the design specifications and drawings",
    );
    // A one-line sub-bullet stays under its bullet.
    expect(lists[0].items[0].children.map((i) => i.text)).toEqual([
      "ASHRAE Standard 90.1-2013, Appendix G",
    ]);
  });

  it("W-02: a lettered list with no heading and the page number after a colon stripped", () => {
    const lists = guidanceLists(fixture("w02"));
    expect(lists).toHaveLength(1);
    expect(lists[0].heading).toBeNull();
    expect(lists[0].intro).toBeNull();
    expect(lists[0].items).toHaveLength(4);
    expect(lists[0].items[0].text).not.toMatch(/\b135\b/);
    expect(lists[0].items[0].text).toContain("midsummer baseline: Table W-02.1");
  });

  it("returns [] for prose with no list, for empty text and for null", () => {
    expect(guidanceLists("No list here. Just two sentences about the credit.")).toEqual([]);
    expect(guidanceLists("")).toEqual([]);
    expect(guidanceLists(null)).toEqual([]);
    expect(guidanceLists(undefined)).toEqual([]);
  });

  it("ignores a lettered marker out of sequence (prose like '(see e) above')", () => {
    expect(guidanceLists("Refer to item e) of the plan. Nothing else.")).toEqual([]);
    const lists = guidanceLists("The plan covers: a) Dust b) Noise d) Waste");
    expect(lists[0].items.map((i) => i.text)).toEqual(["Dust", "Noise d) Waste"]);
  });

  it("a stray page number alone does not make a row", () => {
    const lists = guidanceLists("Items are: • First item. 57 • Second item.");
    expect(lists[0].items.map((i) => i.text)).toEqual(["First item.", "Second item."]);
  });
});
