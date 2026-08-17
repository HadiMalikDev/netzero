import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseManual } from "@/lib/parser/index";
import { mostadamGate } from "@/lib/parser/mostadam";
import { extractPdf } from "@/lib/parser/extract";

const MANUAL = ".data/manuals/commercial-dc.pdf";
const has = existsSync(MANUAL);

// The manual is a 6MB public PDF (see spec "Default test files"). If it hasn't
// been downloaded, skip rather than fail so CI without the fixture stays green.
const d = has ? describe : describe.skip;

d("Commercial D+C parser (known-good HC-10 check)", () => {
  it("walks the whole manual, not one hardcoded credit", async () => {
    const data = new Uint8Array(await readFile(MANUAL));
    const res = await parseManual(data); // deterministic only (no AI in tests)
    expect(res.ok).toBe(true);
    expect(res.scheme).toBe("commercial");
    expect(res.stage).toBe("D+C");
    // Many credits, spanning multiple categories.
    expect(res.credits.length).toBeGreaterThan(40);
    const cats = new Set(res.credits.map((c) => c.categoryCode));
    expect(cats.size).toBeGreaterThanOrEqual(6);
    // No duplicate codes after within-doc dedupe.
    const codes = res.credits.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("extracts HC-10 Indoor Air Quality exactly", async () => {
    const data = new Uint8Array(await readFile(MANUAL));
    const res = await parseManual(data);
    const hc10 = res.credits.find((c) => c.code === "HC-10");
    expect(hc10, "HC-10 must be extracted").toBeDefined();
    expect(hc10!.title).toBe("Indoor Air Quality");
    expect(hc10!.categoryName).toBe("Health and Comfort");
    expect(hc10!.isKeystone).toBe(false);
    expect(hc10!.pointsRaw).toBe("3");
    expect(hc10!.requirements).toHaveLength(2);

    const [r1, r2] = hc10!.requirements;
    expect(r1.pointsRaw).toBe("1");
    // Title is split from the body.
    expect(r1.title).toBe("Indoor Air Quality (IAQ) Management Plan");
    expect(r1.text).toMatch(/^Develop and implement/i);
    expect(r1.text).toMatch(/flush-out/i);
    expect(r2.pointsRaw).toBe("2");
    expect(r2.metricType).toBe("NUMERIC");

    // Table HC-10.1 limits.
    const limits = r2.numericSpec?.limits ?? [];
    const byName = (kw: RegExp) =>
      limits.find((l) => kw.test(l.name))?.value;
    expect(byName(/formaldehyde/i)).toBe(27);
    expect(byName(/PM2\.5/i)).toBe(15);
    expect(byName(/PM10/i)).toBe(150);
    expect(byName(/TVOC|Volatile/i)).toBe(500);

    // Citations point at the source pages (HC-10 is on pp.182-185 of the PDF).
    expect(hc10!.pageStart).toBeGreaterThanOrEqual(180);
    expect(hc10!.pageStart).toBeLessThanOrEqual(186);

    const typologies = Object.keys(hc10!.applicability?.["Full Scope"] ?? {});
    expect(typologies.length).toBeGreaterThanOrEqual(4);
    expect(typologies.every((t) => !/^col\d+$/.test(t))).toBe(true);
  });

  it("does not split TC-03 at a mid-sentence digit", async () => {
    const data = new Uint8Array(await readFile(MANUAL));
    const res = await parseManual(data);
    const tc03 = res.credits.find((c) => c.code === "TC-03");
    expect(tc03, "TC-03 must be extracted").toBeDefined();
    expect(tc03!.requirements).toHaveLength(2);
    const [r1, r2] = tc03!.requirements;
    expect(r1.pointsRaw).toBe("1");
    expect(r2.pointsRaw).toBe("1");
    expect(r2.text).toMatch(/3 additional amenities/i);
    expect(r2.text).not.toMatch(/^additional amenities/i);
    expect(r1.evidence.some((e) => e.stage === "design")).toBe(true);
    expect(r2.evidence.some((e) => e.stage === "design")).toBe(true);
    expect(r1.evidence.some((e) => e.stage === "construction")).toBe(true);
    expect(r2.evidence.some((e) => e.stage === "construction")).toBe(true);
  });

  it("splits HC-16's empty #2 from the leftover bullet, not from guidance", async () => {
    const data = new Uint8Array(await readFile(MANUAL));
    const res = await parseManual(data);
    const hc16 = res.credits.find((c) => c.code === "HC-16");
    expect(hc16, "HC-16 must be extracted").toBeDefined();
    expect(hc16!.requirements).toHaveLength(2);
    expect(hc16!.reconciliation?.ok).toBe(true);
    const [r1, r2] = hc16!.requirements;
    expect(r1.pointsRaw).toBe("1");
    expect(r2.pointsRaw).toBe("1");
    expect(r2.text).toMatch(/green walls/i);
    expect(r2.text).not.toMatch(/2%\s+of the floor area/i);
  });

  it("reconciles to the manual's own totals and populates staged evidence", async () => {
    const data = new Uint8Array(await readFile(MANUAL));
    const res = await parseManual(data);

    // Every credit parses at least one requirement (no silent drop-outs).
    expect(res.credits.every((c) => c.requirements.length > 0)).toBe(true);

    // Per-scope reconcile matches Table 4 (Full = 130, Shell only = 35, …).
    expect(res.scopeTotals).toEqual({
      "Shell Only": 35,
      "Core & Shell": 130,
      "Fit Out": 100,
      "Full Scope": 130,
    });
    expect(res.reconciliation?.scopes.every((s) => s.ok)).toBe(true);

    // Evidence is split by submission stage and broadly populated.
    const hc10 = res.credits.find((c) => c.code === "HC-10")!;
    const r1 = hc10.requirements[0];
    expect(r1.evidence.some((e) => e.stage === "design")).toBe(true);
    expect(r1.evidence.some((e) => e.stage === "construction")).toBe(true);

    const withEvidence = res.credits.reduce(
      (n, c) => n + c.requirements.filter((r) => r.evidence.length > 0).length,
      0,
    );
    const totalReq = res.credits.reduce((n, c) => n + c.requirements.length, 0);
    expect(withEvidence / totalReq).toBeGreaterThan(0.7);
  });

  it("rejects a non-Mostadam document", async () => {
    // A PDF-shaped but non-Mostadam text blob must fail the gate.
    const fake = "This is a LEED v4 reference guide. Sustainable Sites credit.";
    const gate = mostadamGate(fake, [fake]);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBeTruthy();
  });

  it("extracts Points Achieved band tables onto scaled requirements", async () => {
    const data = new Uint8Array(await readFile(MANUAL));
    const res = await parseManual(data);

    const pairs = (c: string) => {
      const credit = res.credits.find((x) => x.code === c);
      expect(credit, `${c} must be extracted`).toBeDefined();
      const scaled = credit!.requirements.find((r) => r.pointsType === "scaled");
      expect(scaled, `${c} must have a scaled requirement`).toBeDefined();
      return (scaled!.numericSpec?.bands ?? []).map((s) =>
        s.bands.map((b) => [b.points, b.min] as const),
      );
    };

    expect(pairs("E-01")).toEqual([
      [
        [5, 0],
        [6, 3],
        [7, 6],
        [8, 10],
        [9, 14],
        [10, 18],
        [11, 22],
        [12, 26],
        [13, 30],
        [14, 35],
        [15, 40],
      ],
    ]);
    const e01 = res.credits.find((c) => c.code === "E-01")!;
    expect(e01.requirements.every((r) => r.optionGroup === "E-01 options")).toBe(
      true,
    );

    const e04 = pairs("E-04");
    expect(e04).toHaveLength(2);
    expect(e04[0]).toEqual([
      [1, 4],
      [2, 6],
      [3, 9],
      [4, 12],
      [5, 15],
    ]);
    expect(e04[1]).toEqual([
      [3, 4],
      [4, 6],
      [5, 9],
      [6, 12],
      [7, 15],
    ]);

    expect(pairs("W-01")[0]).toEqual([
      [3, 10],
      [4, 15],
      [5, 20],
      [6, 25],
      [7, 30],
      [8, 35],
      [9, 40],
      [10, 45],
    ]);
    expect(pairs("W-02")[0]).toEqual([
      [2, 50],
      [3, 60],
      [4, 70],
      [5, 80],
    ]);
  });

  it("extract keeps per-page text for citations", async () => {
    const data = new Uint8Array(await readFile(MANUAL));
    const ext = await extractPdf(data);
    expect(ext.pageCount).toBe(269);
    expect(ext.pages).toHaveLength(269);
  });
});
