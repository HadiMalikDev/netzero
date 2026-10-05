import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { CreditView, ProjectScore } from "@/lib/data";
import { buildScorecard, SCORECARD_COLUMNS } from "@/lib/export/scorecard";
import { parseThresholds, projectPoints, tierForPoints } from "@/lib/tiers";

const credit = (over: Partial<CreditView>): CreditView =>
  ({
    projectCreditId: over.code,
    catalogCreditId: over.code,
    title: "",
    categoryCode: "E",
    categoryName: "Energy",
    isKeystone: false,
    pointsRaw: null,
    aim: null,
    pageStart: null,
    pageEnd: null,
    status: "not_started",
    pointsEarned: 0,
    pointsMax: null,
    pointsMin: null,
    targeted: true,
    requirements: [],
    additionalAttachments: [],
    ...over,
  }) as CreditView;

const credits = [
  credit({ code: "E-01", title: "Energy Performance", isKeystone: true, pointsMin: 5, pointsMax: 15, pointsEarned: 8, status: "completed" }),
  credit({ code: "E-02", title: "Energy Metering", isKeystone: true, pointsMax: 2 }),
  credit({ code: "PMM-03", title: "Fair Labor Practices", categoryCode: "PMM", categoryName: "Policies", requirements: [{ pointsRaw: "2" }] as CreditView["requirements"], targeted: false, status: "in_progress" }),
];
const thresholds = parseThresholds('[{"tier":"Green","min":25},{"tier":"Gold","min":85}]');
const points = projectPoints(credits);
const score: ProjectScore = {
  ...points,
  thresholds,
  target: thresholds[1],
  reached: null,
  byPoints: tierForPoints(points.earned, thresholds),
  scaleMax: 130,
};

async function readBack() {
  const wb = buildScorecard({
    projectName: "Jeddah Central Oceanarium",
    ratingSystem: "Mostadam commercial D+C (2019)",
    credits,
    score,
    generatedAt: new Date("2026-10-05T10:00:00Z"),
  });
  const buf = await wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buf as ArrayBuffer);
  const ws = back.getWorksheet("Scorecard")!;
  const rows: unknown[][] = [];
  ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1)));
  return rows;
}

describe("buildScorecard", () => {
  it("writes the header block and column headings", async () => {
    const rows = await readBack();
    expect(rows[1]).toEqual(["Project", "Jeddah Central Oceanarium"]);
    expect(rows[3]).toEqual(["Target level", "Gold (85+ points)"]);
    expect(rows[7]).toEqual([...SCORECARD_COLUMNS]);
  });

  it("lists every credit, ranges as text and single values as numbers", async () => {
    const rows = await readBack();
    const e01 = rows.find((r) => r[0] === "E-01")!;
    const e02 = rows.find((r) => r[0] === "E-02")!;
    expect(e01).toEqual(["E-01", "Energy Performance", "Energy", "Yes", "5–15", "5–15", 8, "Completed"]);
    expect(e02.slice(4, 6)).toEqual([2, 2]);
  });

  it("labels a credit that is not targeted, using requirement points when it has no Total", async () => {
    const rows = await readBack();
    const pmm = rows.find((r) => r[0] === "PMM-03")!;
    expect(pmm.slice(4, 8)).toEqual([2, "Not targeted", 0, "In Progress"]);
  });

  it("groups by category and sums ranges in the totals row", async () => {
    const rows = await readBack();
    expect(rows.some((r) => r[0] === "PMM · Policies")).toBe(true);
    const total = rows.at(-1)!;
    expect(total.slice(1, 7)).toEqual(["Total", "", "1 of 2 complete", "9–19", "7–17", 8]);
  });
});
