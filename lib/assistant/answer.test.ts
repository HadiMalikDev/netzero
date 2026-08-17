import { describe, expect, it } from "vitest";
import { deterministicAnswer } from "./answer";
import { creditHref, creditMd, type ProjectFacts } from "./facts";

const facts: ProjectFacts = {
  projectName: "Tower",
  totals: {
    credits: 1,
    completed: 0,
    in_progress: 1,
    not_started: 0,
    requirements: 2,
    missingEvidence: 0,
  },
  categories: [{ code: "E", name: "Energy", count: 1 }],
  credits: [
    {
      code: "E-01",
      title: "Energy Performance",
      category: "E Energy",
      status: "in_progress",
      page: 100,
      href: creditHref("p1", "E-01"),
      requirements: [
        {
          seq: 1,
          metricType: "BOOLEAN",
          status: "not_started",
          optionGroup: null,
          hasValue: false,
          requiresEvidence: false,
          evidenceCount: 0,
          text: "SBC 601",
          page: 100,
          href: creditHref("p1", "E-01", 1),
        },
        {
          seq: 2,
          metricType: "NUMERIC",
          status: "completed",
          optionGroup: null,
          hasValue: true,
          requiresEvidence: false,
          evidenceCount: 0,
          text: "modeling",
          page: 100,
          href: creditHref("p1", "E-01", 2),
        },
      ],
    },
  ],
};

describe("credit links", () => {
  it("builds credit and requirement hrefs", () => {
    expect(creditHref("p1", "E-01")).toBe("/projects/p1/credits/E-01");
    expect(creditHref("p1", "E-01", 2)).toBe("/projects/p1/credits/E-01#req-2");
    expect(creditMd("p1", "E-01", "Energy Performance")).toBe(
      "[E-01 Energy Performance](/projects/p1/credits/E-01)",
    );
  });

  it("deterministic answers link the credit and open requirements", () => {
    const a = deterministicAnswer(facts, "status of E-01", "p1");
    expect(a.answer).toContain("[E-01 Energy Performance](/projects/p1/credits/E-01)");
    expect(a.answer).toContain("[E-01 #1](/projects/p1/credits/E-01#req-1)");
    expect(a.answer).not.toContain("#req-2");
  });
});
