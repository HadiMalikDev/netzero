import { describe, expect, it } from "vitest";
import { computePart, previousMonth, revisionAt, type Snapshot, type SnapshotProduct, type SnapshotRevision } from "@/lib/materials/credits";
import { expiryOf, monthEnd, parseIsoDate, todayIso } from "@/lib/materials/expiry";
import { partByKey } from "@/lib/materials/parts";

const steel = partByKey("MW-05:steel")!;
const voc = partByKey("HC-11:voc")!;
const ksa = partByKey("RC-01:ksa")!;
const insulation = partByKey("MW-04:insulation")!;

function rev(over: Partial<SnapshotRevision> = {}): SnapshotRevision {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    revision: 0,
    status: "A",
    reviewedOn: "2026-05-05",
    createdOn: "2026-04-28",
    interior: true,
    parts: ["MW-05:steel"],
    boq: { weightT: 100, volumeM3: null, costSar: null },
    answers: [{ creditCode: "MW-05", linked: true, answer: "yes", text: "Recycled content datasheet", docs: [{ issuedOn: "2025-01-10" }] }],
    ...over,
  };
}

function product(key: string, revisions: SnapshotRevision[], deliveries: SnapshotProduct["deliveries"] = []): SnapshotProduct {
  return { key, name: key, submittalRef: "TBE-0001", revisions, deliveries };
}

const snap = (products: SnapshotProduct[], boq: number | null = null): Snapshot => ({ expiryYears: 3, boqMaterialCostSar: boq, products });

describe("expiry", () => {
  it("counts the window in calendar years and warns in the last 30 days", () => {
    expect(expiryOf("2023-05-12", 3, "2026-05-11")).toMatchObject({ state: "expiring", expiresOn: "2026-05-12", daysLeft: 1 });
    expect(expiryOf("2023-05-12", 3, "2026-05-12").state).toBe("expired");
    expect(expiryOf("2023-05-12", 3, "2026-04-01").state).toBe("valid");
    expect(expiryOf("2024-02-29", 1, "2025-02-28").state).toBe("expiring");
  });

  it("parses dates and months strictly", () => {
    expect(parseIsoDate("2023-02-30")).toBeNull();
    expect(parseIsoDate("2024-02-29")).toBe("2024-02-29");
    expect(parseIsoDate("12/05/2023")).toBeNull();
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(todayIso(new Date("2026-10-27T22:30:00Z"))).toBe("2026-10-28"); // Saudi time
  });
});

describe("revisionAt", () => {
  const p = product("rebar", [
    rev({ id: "r0", revision: 0, status: "C", reviewedOn: "2026-05-05", createdOn: "2026-04-28" }),
    rev({ id: "r1", revision: 1, status: "A", reviewedOn: "2026-07-02", createdOn: "2026-06-10" }),
  ]);

  it("uses the latest revision reviewed by the month's end", () => {
    expect(revisionAt(p, "2026-04")).toMatchObject({ id: "r0", status: null }); // entered, not yet reviewed
    expect(revisionAt(p, "2026-06")).toMatchObject({ id: "r0", status: "C" });
    expect(revisionAt(p, "2026-07")).toMatchObject({ id: "r1", status: "A" });
    expect(revisionAt(p, "2026-03")).toBeNull();
  });
});

describe("computePart", () => {
  it("MW-05 steel: compliant weight over all steel, rejected left out, C pending", () => {
    const s = snap([
      product("ittifaq", [rev({ boq: { weightT: 600, volumeM3: null, costSar: null } })]),
      product("western", [rev({ status: "C", boq: { weightT: 300, volumeM3: null, costSar: null } })]),
      product("thilal", [rev({ status: "B", boq: { weightT: 100, volumeM3: null, costSar: null }, answers: [{ creditCode: "MW-05", linked: true, answer: "no", text: "Recycled content datasheet", docs: [] }] })]),
      product("rejected", [rev({ status: "D", boq: { weightT: 999, volumeM3: null, costSar: null } })]),
    ]);
    const r = computePart(steel, s, "2026-05");
    expect(r.forecast).toEqual({ num: 600, den: 1000, pct: 60 });
    expect(r.pendingPct).toBe(30);
    expect(r.met).toEqual([true]);
    expect(r.products.map((p) => [p.key, p.state])).toEqual([
      ["ittifaq", "compliant"],
      ["western", "pending"],
      ["thilal", "not_compliant"],
    ]);
    expect(r.products[2].reasons[0]).toMatch(/^Answered No/);
  });

  it("actual uses deliveries up to the month's end", () => {
    const s = snap([
      product("a", [rev()], [
        { deliveredOn: "2026-05-20", weightT: 40, volumeM3: null, costSar: null },
        { deliveredOn: "2026-06-03", weightT: 60, volumeM3: null, costSar: null },
      ]),
      product("b", [rev({ answers: [] })], [{ deliveredOn: "2026-05-02", weightT: 60, volumeM3: null, costSar: null }]),
    ]);
    expect(computePart(steel, s, "2026-05").actual).toEqual({ num: 40, den: 100, pct: 40 });
    expect(computePart(steel, s, "2026-06").actual).toEqual({ num: 100, den: 160, pct: 62.5 });
  });

  it("an expired certificate on a Yes row stops the product counting", () => {
    const s = snap([product("a", [rev({ reviewedOn: "2026-04-10", answers: [{ creditCode: "MW-05", linked: true, answer: "yes", text: "Datasheet", docs: [{ issuedOn: "2023-05-12" }] }] })])]);
    expect(computePart(steel, s, "2026-04").products[0].state).toBe("compliant");
    const late = computePart(steel, s, "2026-05").products[0];
    expect(late.state).toBe("not_compliant");
    expect(late.reasons[0]).toMatch(/expired \(issued 2023-05-12\)/);
  });

  it("N/A rows are neutral, but at least one row must be Yes; unlinked rows never count", () => {
    const answers = (a: string, b: string) => [
      { creditCode: "HC-11", linked: true, answer: a, text: "VOC content", docs: [] },
      { creditCode: "HC-11", linked: true, answer: b, text: "Emission test", docs: [] },
    ];
    const base = { parts: ["HC-11:voc"], boq: { weightT: 1, volumeM3: null, costSar: null } };
    expect(computePart(voc, snap([product("a", [rev({ ...base, answers: answers("yes", "na") })])]), "2026-05").products[0].state).toBe("compliant");
    expect(computePart(voc, snap([product("a", [rev({ ...base, answers: answers("na", "na") })])]), "2026-05").products[0].state).toBe("not_compliant");
    const unlinked = [{ creditCode: "HC-11", linked: false, answer: "yes", text: "VOC content", docs: [] }];
    expect(computePart(voc, snap([product("a", [rev({ ...base, answers: unlinked })])]), "2026-05").products[0].reasons[0]).toMatch(/No HC-11 rows/);
  });

  it("HC-11 VOC counts interior products only (the JOTUN exterior primer is out)", () => {
    const base = { parts: ["HC-11:voc"], answers: [{ creditCode: "HC-11", linked: true, answer: "yes", text: "VOC", docs: [] }] };
    const s = snap([
      product("in", [rev({ ...base, boq: { weightT: 2, volumeM3: null, costSar: null } })]),
      product("out", [rev({ ...base, interior: false, boq: { weightT: 8, volumeM3: null, costSar: null } })]),
    ]);
    const r = computePart(voc, s, "2026-05");
    expect(r.products.map((p) => p.key)).toEqual(["in"]);
    expect(r.forecast.pct).toBe(100);
  });

  it("RC-01 divides by the BOQ total when entered, and shows how much of it the app covers", () => {
    const base = { parts: ["RC-01:ksa"], answers: [{ creditCode: "RC-01", linked: true, answer: "yes", text: "Proof of KSA manufacture", docs: [] }] };
    const s = snap(
      [
        product("ksa", [rev({ ...base, boq: { weightT: null, volumeM3: null, costSar: 300_000 } })]),
        product("import", [rev({ ...base, answers: [{ ...base.answers[0], answer: "no" }], boq: { weightT: null, volumeM3: null, costSar: 200_000 } })]),
      ],
      1_000_000,
    );
    const r = computePart(ksa, s, "2026-05");
    expect(r.forecast).toEqual({ num: 300_000, den: 1_000_000, pct: 30 });
    expect(r.met).toEqual([true, false]);
    expect(r.coverage).toMatchObject({ boqTotal: 1_000_000, productsBoq: 500_000, productsBoqPct: 50 });
    // Without a BOQ total it falls back to the products in the app.
    expect(computePart(ksa, { ...s, boqMaterialCostSar: null }, "2026-05").forecast.pct).toBe(60);
  });

  it("MW-04 counts products, needs every one, and has no actual", () => {
    const base = { parts: ["MW-04:insulation"], boq: { weightT: null, volumeM3: null, costSar: null } };
    const ok = [{ creditCode: "MW-04", linked: true, answer: "yes", text: "No CFC/HCFC, ODP 0, GWP ≤ 5", docs: [] }];
    const s = snap([product("a", [rev({ ...base, answers: ok })]), product("b", [rev({ ...base, answers: ok, status: null, reviewedOn: null })])]);
    const r = computePart(insulation, s, "2026-05");
    expect(r.forecast).toEqual({ num: 1, den: 2, pct: 50 });
    expect(r.met).toEqual([false]);
    expect(r.actual).toBeNull();
    expect(r.missingQuantity).toBe(0);
  });

  it("flags products without a quantity for the part's basis", () => {
    const s = snap([product("a", [rev({ boq: { weightT: null, volumeM3: 5, costSar: 10 } })])]);
    expect(computePart(steel, s, "2026-05").missingQuantity).toBe(1);
  });
});
