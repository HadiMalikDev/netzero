import { describe, expect, it } from "vitest";
import {
  blockingRequirements,
  deriveCreditStatus,
  deriveRequirementStatus,
  hasValue,
  type EntryState,
} from "@/lib/status";

const base: EntryState = {
  metricType: "BOOLEAN",
  requiresEvidence: false,
  valueBool: null,
  valueNumber: null,
  valueText: null,
  evidenceCount: 0,
};

describe("hasValue", () => {
  it("judges presence by the row's own metric type", () => {
    // A NUMERIC row is satisfied by a number, not by stray text left in another
    // column — the divergence the assistant's inline check used to get wrong.
    expect(
      hasValue({ ...base, metricType: "NUMERIC", valueText: "n/a" }),
    ).toBe(false);
    expect(
      hasValue({ ...base, metricType: "NUMERIC", valueNumber: 42 }),
    ).toBe(true);
    expect(hasValue({ ...base, metricType: "BOOLEAN", valueBool: true })).toBe(
      true,
    );
    expect(
      hasValue({ ...base, metricType: "DESCRIPTIVE", valueText: "done" }),
    ).toBe(true);
  });
});

describe("deriveRequirementStatus", () => {
  it("not_started with no value and no evidence", () => {
    expect(deriveRequirementStatus(base)).toBe("not_started");
  });

  it("boolean checked + no evidence required => completed", () => {
    expect(deriveRequirementStatus({ ...base, valueBool: true })).toBe(
      "completed",
    );
  });

  it("numeric value present but evidence required and missing => in_progress", () => {
    expect(
      deriveRequirementStatus({
        ...base,
        metricType: "NUMERIC",
        valueNumber: 15,
        requiresEvidence: true,
        evidenceCount: 0,
      }),
    ).toBe("in_progress");
  });

  it("numeric value + required evidence attached => completed", () => {
    expect(
      deriveRequirementStatus({
        ...base,
        metricType: "NUMERIC",
        valueNumber: 15,
        requiresEvidence: true,
        evidenceCount: 1,
      }),
    ).toBe("completed");
  });

  it("evidence attached but no value => in_progress", () => {
    expect(
      deriveRequirementStatus({
        ...base,
        metricType: "DESCRIPTIVE",
        requiresEvidence: true,
        evidenceCount: 2,
      }),
    ).toBe("in_progress");
  });
});

describe("deriveCreditStatus", () => {
  it("all ungrouped completed => completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed" },
        { status: "completed" },
      ]),
    ).toBe("completed");
  });
  it("all not_started => not_started", () => {
    expect(
      deriveCreditStatus([
        { status: "not_started" },
        { status: "not_started" },
      ]),
    ).toBe("not_started");
  });
  it("ungrouped mixed => in_progress", () => {
    expect(
      deriveCreditStatus([
        { status: "completed" },
        { status: "not_started" },
      ]),
    ).toBe("in_progress");
  });

  it("XOR only: one option completed => completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed", optionGroup: "E-01 options" },
        { status: "not_started", optionGroup: "E-01 options" },
      ]),
    ).toBe("completed");
  });

  it("XOR only: one option in progress => in_progress", () => {
    expect(
      deriveCreditStatus([
        { status: "in_progress", optionGroup: "E-01 options" },
        { status: "not_started", optionGroup: "E-01 options" },
      ]),
    ).toBe("in_progress");
  });

  it("required + XOR: required done, option untouched => in_progress", () => {
    expect(
      deriveCreditStatus([
        { status: "completed" },
        { status: "not_started", optionGroup: "opts" },
        { status: "not_started", optionGroup: "opts" },
      ]),
    ).toBe("in_progress");
  });

  it("required + XOR: required done and one option done => completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed" },
        { status: "completed", optionGroup: "opts" },
        { status: "not_started", optionGroup: "opts" },
      ]),
    ).toBe("completed");
  });

  it("two XOR groups: one group done, the other not => in_progress", () => {
    expect(
      deriveCreditStatus([
        { status: "completed", optionGroup: "A" },
        { status: "not_started", optionGroup: "A" },
        { status: "not_started", optionGroup: "B" },
        { status: "not_started", optionGroup: "B" },
      ]),
    ).toBe("in_progress");
  });

  it("two XOR groups: one option each => completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed", optionGroup: "A" },
        { status: "not_started", optionGroup: "A" },
        { status: "not_started", optionGroup: "B" },
        { status: "completed", optionGroup: "B" },
      ]),
    ).toBe("completed");
  });

  it("XOR only: both options completed still completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed", optionGroup: "opts" },
        { status: "completed", optionGroup: "opts" },
      ]),
    ).toBe("completed");
  });
});

describe("blockingRequirements", () => {
  it("drops unused XOR options once one is completed", () => {
    expect(
      blockingRequirements([
        { status: "completed" as const, optionGroup: "opts", seq: 1 },
        { status: "not_started" as const, optionGroup: "opts", seq: 2 },
      ]).map((r) => r.seq),
    ).toEqual([]);
  });

  it("keeps every option when the XOR group is unsatisfied", () => {
    expect(
      blockingRequirements([
        { status: "in_progress" as const, optionGroup: "opts", seq: 1 },
        { status: "not_started" as const, optionGroup: "opts", seq: 2 },
      ]).map((r) => r.seq),
    ).toEqual([1, 2]);
  });
});
