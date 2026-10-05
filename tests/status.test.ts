import { describe, expect, it } from "vitest";
import {
  blockingRequirements,
  deriveCreditStatus,
  deriveRequirementStatus,
  evidenceSatisfied,
  hasValue,
  optionalFlags,
  missingEvidenceRequirements,
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

describe("optionalFlags", () => {
  const row = (pointsRaw: string | null, keystone = false, optionGroup: string | null = null) => ({
    pointsRaw,
    keystone,
    optionGroup,
  });

  it("W-02: keystone #1 mandatory, the extra point rows optional", () => {
    expect(
      optionalFlags([row("2", true), row("3"), row("2"), row("2"), row("1")]),
    ).toEqual([false, true, true, true, true]);
  });

  it("a credit's only point-earning row is the credit itself (PMM-03)", () => {
    expect(optionalFlags([row("2")])).toEqual([false]);
  });

  it("a prerequisite with no points keeps the scoring row mandatory (E-03)", () => {
    expect(optionalFlags([row(null), row("2")])).toEqual([false, false]);
  });

  it("a keystone row is mandatory even when it carries points (W-01)", () => {
    expect(optionalFlags([row("3", true), row("7")])).toEqual([false, true]);
  });

  it("either/or options are governed by their group, not this rule", () => {
    expect(
      optionalFlags([row("5", false, "E-01 options"), row("15", false, "E-01 options")]),
    ).toEqual([false, false]);
  });

  it("zero points is no points", () => {
    expect(optionalFlags([row("0"), row("1")])).toEqual([false, false]);
  });
});

describe("optional rows never block", () => {
  it("mandatory done + optional untouched => completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed" },
        { status: "not_started", optional: true },
        { status: "not_started", optional: true },
      ]),
    ).toBe("completed");
  });

  it("an optional row that was started must be finished", () => {
    expect(
      deriveCreditStatus([
        { status: "completed" },
        { status: "in_progress", optional: true },
      ]),
    ).toBe("in_progress");
  });

  it("only optional rows: nothing done => not_started", () => {
    expect(
      deriveCreditStatus([
        { status: "not_started", optional: true },
        { status: "not_started", optional: true },
      ]),
    ).toBe("not_started");
  });

  it("only optional rows: one finished, rest untouched => completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed", optional: true },
        { status: "not_started", optional: true },
      ]),
    ).toBe("completed");
  });

  it("untouched optional rows are not blocking", () => {
    expect(
      blockingRequirements([
        { status: "not_started" as const, seq: 1 },
        { status: "not_started" as const, optional: true, seq: 2 },
        { status: "in_progress" as const, optional: true, seq: 3 },
      ]).map((r) => r.seq),
    ).toEqual([1, 3]);
  });
});

describe("a chosen either/or path", () => {
  it("only the chosen path counts: a set-aside option done does not complete it", () => {
    expect(
      deriveCreditStatus([
        { status: "not_started", optionGroup: "opts", planned: true },
        { status: "completed", optionGroup: "opts", planned: false },
      ]),
    ).toBe("not_started");
  });

  it("chosen path done => completed", () => {
    expect(
      deriveCreditStatus([
        { status: "completed", optionGroup: "opts", planned: true },
        { status: "not_started", optionGroup: "opts", planned: false },
      ]),
    ).toBe("completed");
  });

  it("set-aside options never appear as blocking or missing evidence", () => {
    const reqs = [
      { status: "in_progress" as const, optionGroup: "opts", planned: true, seq: 1, requiresEvidence: true, evidenceCount: 0 },
      { status: "not_started" as const, optionGroup: "opts", planned: false, seq: 2, requiresEvidence: true, evidenceCount: 0 },
    ];
    expect(blockingRequirements(reqs).map((r) => r.seq)).toEqual([1]);
    expect(missingEvidenceRequirements(reqs).map((r) => r.seq)).toEqual([1]);
  });
});

describe("documents due gate completion", () => {
  const filled = { ...base, metricType: "DESCRIPTIVE", valueText: "Plan issued.", requiresEvidence: true };

  it("one of two due documents provided => in_progress, not completed", () => {
    expect(
      deriveRequirementStatus({ ...filled, evidenceCount: 3, docsDue: 2, docsProvided: 1 }),
    ).toBe("in_progress");
  });

  it("every due document provided => completed", () => {
    expect(
      deriveRequirementStatus({ ...filled, evidenceCount: 2, docsDue: 2, docsProvided: 2 }),
    ).toBe("completed");
  });

  it("files that claim no document do not stand in for a due one", () => {
    expect(evidenceSatisfied({ requiresEvidence: true, evidenceCount: 4, docsDue: 1, docsProvided: 0 })).toBe(false);
  });

  it("no listed documents => at least one file, as before", () => {
    expect(evidenceSatisfied({ requiresEvidence: true, evidenceCount: 1, docsDue: 0 })).toBe(true);
    expect(evidenceSatisfied({ requiresEvidence: true, evidenceCount: 0, docsDue: 0 })).toBe(false);
  });

  it("missing evidence lists a blocking row with a due document outstanding", () => {
    const reqs = [
      { seq: 1, status: "in_progress" as const, requiresEvidence: true, evidenceCount: 2, docsDue: 3, docsProvided: 2 },
      { seq: 2, status: "completed" as const, requiresEvidence: true, evidenceCount: 1, docsDue: 1, docsProvided: 1 },
    ];
    expect(missingEvidenceRequirements(reqs).map((r) => r.seq)).toEqual([1]);
  });
});
