import { describe, expect, it } from "vitest";
import {
  creditPointsEarned,
  creditPointsRange,
  pointsAwarded,
  pointsForValue,
} from "./points";
import type { ScoreBand } from "./parser/types";

const E01: ScoreBand[] = [
  { min: 0, points: 5 },
  { min: 3, points: 6 },
  { min: 6, points: 7 },
  { min: 10, points: 8 },
  { min: 14, points: 9 },
  { min: 18, points: 10 },
  { min: 22, points: 11 },
  { min: 26, points: 12 },
  { min: 30, points: 13 },
  { min: 35, points: 14 },
  { min: 40, points: 15 },
];

const W01: ScoreBand[] = [
  { min: 10, points: 3 },
  { min: 15, points: 4 },
  { min: 20, points: 5 },
  { min: 25, points: 6 },
  { min: 30, points: 7 },
  { min: 35, points: 8 },
  { min: 40, points: 9 },
  { min: 45, points: 10 },
];

describe("pointsForValue", () => {
  it("looks up E-01 bands", () => {
    expect(pointsForValue(E01, 22)).toBe(11);
    expect(pointsForValue(E01, 0)).toBe(5);
    expect(pointsForValue(E01, 40)).toBe(15);
    expect(pointsForValue(E01, 21)).toBe(10);
  });

  it("returns 0 below the first band", () => {
    expect(pointsForValue(W01, 5)).toBe(0);
  });
});

describe("creditPointsRange", () => {
  it("uses the band floor and the credit Total", () => {
    expect(
      creditPointsRange(
        [{ numericSpec: { bands: [{ label: null, bands: E01 }] } }],
        "15",
      ),
    ).toEqual({ min: 5, max: 15 });
  });
});

describe("creditPointsEarned", () => {
  it("XOR keeps the better option, not the sum", () => {
    const reqs = [
      {
        metricType: "BOOLEAN",
        pointsRaw: "5",
        optionGroup: "E-01 options",
        status: "completed" as const,
      },
      {
        metricType: "NUMERIC",
        pointsRaw: "15",
        optionGroup: "E-01 options",
        numericSpec: { bands: [{ label: null, bands: E01 }] },
        valueNumber: 40,
        status: "completed" as const,
      },
    ];
    expect(creditPointsEarned(reqs, "15")).toBe(15);
  });

  it("caps W-01 keystone + table so 45% is 10 not 13", () => {
    const reqs = [
      {
        metricType: "BOOLEAN",
        pointsRaw: "3",
        optionGroup: null,
        status: "completed" as const,
      },
      {
        metricType: "NUMERIC",
        pointsRaw: "7",
        optionGroup: null,
        numericSpec: { bands: [{ label: null, bands: W01 }] },
        valueNumber: 45,
        status: "completed" as const,
      },
    ];
    expect(pointsAwarded(reqs[1], "earned")).toBe(10);
    expect(creditPointsEarned(reqs, "10")).toBe(10);
  });

  it("preview looks up a number before the row is completed", () => {
    const req = {
      metricType: "NUMERIC",
      pointsRaw: "15",
      numericSpec: { bands: [{ label: null, bands: E01 }] },
      valueNumber: 22,
      status: "in_progress" as const,
    };
    expect(pointsAwarded(req, "preview")).toBe(11);
    expect(pointsAwarded(req, "earned")).toBe(0);
  });
});
