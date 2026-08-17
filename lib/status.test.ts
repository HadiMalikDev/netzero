import { describe, expect, it } from "vitest";
import {
  deriveCreditStatus,
  deriveRequirementStatus,
  type EntryState,
} from "./status";

const base: EntryState = {
  metricType: "BOOLEAN",
  requiresEvidence: false,
  valueBool: null,
  valueNumber: null,
  valueText: null,
  evidenceCount: 0,
};

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
  it("all completed => completed", () => {
    expect(deriveCreditStatus(["completed", "completed"])).toBe("completed");
  });
  it("all not_started => not_started", () => {
    expect(deriveCreditStatus(["not_started", "not_started"])).toBe(
      "not_started",
    );
  });
  it("mixed => in_progress", () => {
    expect(deriveCreditStatus(["completed", "not_started"])).toBe("in_progress");
  });
});
