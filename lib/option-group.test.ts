import { describe, expect, it } from "vitest";
import { groupByOption, reduceByOption } from "./option-group";

describe("groupByOption", () => {
  it("keeps ungrouped rows as singles", () => {
    const blocks = groupByOption([
      { seq: 1, optionGroup: null },
      { seq: 2, optionGroup: null },
    ]);
    expect(blocks).toEqual([
      { kind: "single", item: { seq: 1, optionGroup: null } },
      { kind: "single", item: { seq: 2, optionGroup: null } },
    ]);
  });

  it("groups consecutive XOR options", () => {
    const blocks = groupByOption([
      { seq: 1, optionGroup: "E-01 options", title: "Prescriptive" },
      { seq: 2, optionGroup: "E-01 options", title: "Performance" },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "xor", group: "E-01 options" });
    if (blocks[0].kind === "xor") expect(blocks[0].items).toHaveLength(2);
  });

  it("does not merge non-consecutive rows that share a label", () => {
    const blocks = groupByOption([
      { seq: 1, optionGroup: "X" },
      { seq: 2, optionGroup: null },
      { seq: 3, optionGroup: "X" },
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["xor", "single", "xor"]);
  });
});

describe("reduceByOption", () => {
  it("takes MAX within a group and sums slots", () => {
    expect(
      reduceByOption(
        [
          { optionGroup: "opts", n: 5 },
          { optionGroup: "opts", n: 15 },
          { optionGroup: null, n: 3 },
        ],
        (r) => r.n,
      ),
    ).toBe(18);
  });
});
