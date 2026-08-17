import { describe, expect, it } from "vitest";
import { groupByOption } from "./option-group";

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
});
