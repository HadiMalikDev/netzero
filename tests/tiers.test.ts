import { describe, expect, it } from "vitest";
import {
  creditSpan,
  formatSpan,
  parseThresholds,
  projectPoints,
  tierForPoints,
  tierReached,
} from "@/lib/tiers";

// Mostadam Commercial D+C, Full Scope — the manual's Table 1 (p.15).
const DC = parseThresholds(
  JSON.stringify([
    { tier: "Diamond", min: 105 },
    { tier: "Green", min: 25 },
    { tier: "Bronze", min: 45 },
    { tier: "Silver", min: 65 },
    { tier: "Gold", min: 85 },
  ]),
);

describe("parseThresholds", () => {
  it("sorts lowest first", () => {
    expect(DC.map((t) => t.tier)).toEqual(["Green", "Bronze", "Silver", "Gold", "Diamond"]);
  });
  it("is tolerant of null, junk and bad rows", () => {
    expect(parseThresholds(null)).toEqual([]);
    expect(parseThresholds("not json")).toEqual([]);
    expect(parseThresholds('[{"tier":"","min":1},{"tier":"Gold","min":"x"},{"tier":"Green","min":25}]')).toEqual([
      { tier: "Green", min: 25 },
    ]);
  });
});

describe("tier for points", () => {
  it("84 is Silver, 85 is Gold", () => {
    expect(tierForPoints(84, DC)?.tier).toBe("Silver");
    expect(tierForPoints(85, DC)?.tier).toBe("Gold");
  });
  it("below Green is no level", () => {
    expect(tierForPoints(24, DC)).toBeNull();
  });
  it("no level is awarded while a keystone credit is open (§2.5)", () => {
    expect(tierReached(90, DC, false)).toBeNull();
    expect(tierReached(90, DC, true)?.tier).toBe("Gold");
  });
});

const credit = (over: Partial<Parameters<typeof creditSpan>[0]> = {}) => ({
  pointsMax: 10,
  pointsMin: null,
  pointsEarned: 0,
  isKeystone: false,
  status: "not_started",
  targeted: true,
  requirements: [],
  ...over,
});

describe("creditSpan", () => {
  it("is the banded floor to the credit Total", () => {
    expect(creditSpan(credit({ pointsMin: 5, pointsMax: 15 }))).toEqual({ min: 5, max: 15 });
  });
  it("falls back to requirement points when the catalog has no Total (PMM-03)", () => {
    expect(
      creditSpan(credit({ pointsMax: null, requirements: [{ pointsRaw: "2" }] })),
    ).toEqual({ min: 2, max: 2 });
  });
  it("an either/or group counts once, at its best option", () => {
    expect(
      creditSpan(
        credit({
          pointsMax: null,
          requirements: [
            { pointsRaw: "5", optionGroup: "opts" },
            { pointsRaw: "15", optionGroup: "opts" },
          ],
        }),
      ).max,
    ).toBe(15);
  });
});

describe("projectPoints", () => {
  it("sums earned, available and targeted spans, and counts keystones", () => {
    const p = projectPoints([
      credit({ pointsMin: 5, pointsMax: 15, pointsEarned: 7, isKeystone: true, status: "completed" }),
      credit({ pointsMax: 2, isKeystone: true }),
      credit({ pointsMax: 3, targeted: false, pointsEarned: 3 }),
    ]);
    expect(p.earned).toBe(10);
    expect(p.available).toEqual({ min: 10, max: 20 });
    expect(p.targeted).toEqual({ min: 7, max: 17 });
    expect(p.keystones).toEqual({ total: 2, complete: 1 });
    expect(formatSpan(p.targeted)).toBe("7–17");
  });
});
