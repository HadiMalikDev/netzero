import { describe, expect, it } from "vitest";
import { deterministicAnswer } from "@/lib/assistant/answer";
import { creditHref, creditMd, type ProjectFacts } from "@/lib/assistant/facts";

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
          keystone: true,
          planned: true,
          optional: false,
          points: "1",
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
          keystone: false,
          planned: true,
          optional: false,
          points: null,
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

describe("optional rows and set-aside paths", () => {
  const req = (over: Partial<ProjectFacts["credits"][0]["requirements"][0]>) => ({
    seq: 1,
    metricType: "BOOLEAN",
    status: "not_started" as const,
    optionGroup: null,
    keystone: false,
    planned: true,
    optional: false,
    points: null,
    hasValue: false,
    requiresEvidence: true,
    evidenceCount: 0,
    text: "",
    page: 120,
    href: creditHref("p1", "W-02", over.seq ?? 1),
    ...over,
  });
  const w02: ProjectFacts = {
    ...facts,
    credits: [
      {
        code: "W-02",
        title: "Outdoor Water Use",
        category: "W Water",
        status: "completed",
        page: 120,
        href: creditHref("p1", "W-02"),
        requirements: [
          req({ seq: 1, keystone: true, points: "2", status: "completed", hasValue: true, evidenceCount: 1 }),
          req({ seq: 4, optional: true, points: "2" }),
        ],
      },
      {
        code: "E-01",
        title: "Energy Performance",
        category: "E Energy",
        status: "in_progress",
        page: 100,
        href: creditHref("p1", "E-01"),
        requirements: [
          req({ seq: 1, optionGroup: "E-01 options", status: "in_progress", hasValue: true, href: creditHref("p1", "E-01", 1) }),
          req({ seq: 2, optionGroup: "E-01 options", planned: false, href: creditHref("p1", "E-01", 2) }),
        ],
      },
    ],
  };

  it("what's left keeps untouched optional rows, labelled optional", () => {
    const a = deterministicAnswer(w02, "what's left?", "p1");
    expect(a.answer).toContain("**Optional — adds points**");
    expect(a.answer).toContain("[W-02 #4](/projects/p1/credits/W-02#req-4) — optional, +2 pts");
  });

  it("a set-aside either/or path is never listed as open", () => {
    const a = deterministicAnswer(w02, "status of E-01", "p1");
    expect(a.answer).toContain("[E-01 #1]");
    expect(a.answer).not.toContain("#req-2");
  });

  it("missing evidence skips untouched optional rows and set-aside paths", () => {
    const a = deterministicAnswer(w02, "what documents are missing?", "p1");
    expect(a.answer).not.toContain("W-02");
    expect(a.answer).not.toContain("#req-2");
  });
});
