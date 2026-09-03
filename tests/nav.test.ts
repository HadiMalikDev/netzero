import { describe, expect, it } from "vitest";
import {
  activeProjectId,
  dashboardCreditsHref,
  navHref,
  searchParamsQuery,
} from "@/lib/nav";

const CREDITS = { href: "/credits", projectScoped: true };
const DOCUMENTS = { href: "/documents", projectScoped: true };
const PROJECTS = { href: "/projects" };
const DASHBOARD = { href: "/dashboard" };

const P = "106765f2-6295-479d-918c-a610c891e63c";

describe("activeProjectId", () => {
  it("reads the project from a project URL", () => {
    expect(activeProjectId(`/projects/${P}`)).toBe(P);
    expect(activeProjectId(`/projects/${P}/credits`)).toBe(P);
    expect(activeProjectId(`/projects/${P}/credits/PMM-03`)).toBe(P);
  });

  it("is null away from a project", () => {
    expect(activeProjectId("/dashboard")).toBeNull();
    expect(activeProjectId("/projects")).toBeNull();
    expect(activeProjectId("/credits")).toBeNull();
  });

  it("does not treat the create wizard as a project", () => {
    expect(activeProjectId("/projects/new")).toBeNull();
  });
});

describe("navHref", () => {
  it("keeps a project-scoped entry inside the open project", () => {
    // The reported bug: from inside project B these walked to project A.
    expect(navHref(CREDITS, `/projects/${P}`)).toBe(`/projects/${P}/credits`);
    expect(navHref(DOCUMENTS, `/projects/${P}/credits/PMM-03`)).toBe(
      `/projects/${P}/documents`,
    );
  });

  it("falls back to the workspace resolver with no project open", () => {
    expect(navHref(CREDITS, "/dashboard")).toBe("/credits");
    expect(navHref(CREDITS, "/projects/new")).toBe("/credits");
  });

  it("leaves workspace-level entries alone inside a project", () => {
    expect(navHref(PROJECTS, `/projects/${P}/credits`)).toBe("/projects");
    expect(navHref(DASHBOARD, `/projects/${P}`)).toBe("/dashboard");
  });
});

describe("dashboardCreditsHref", () => {
  it("drills into the first project's filtered credits", () => {
    expect(dashboardCreditsHref([P], "missing_evidence")).toBe(
      `/projects/${P}/credits?filter=missing_evidence`,
    );
    expect(dashboardCreditsHref([P], "completed")).toBe(
      `/projects/${P}/credits?filter=completed`,
    );
  });

  it("keeps the filter when the count spans several projects", () => {
    // Same convention as the workspace Credits nav: first project, filtered.
    // Distinct filters must stay distinct — do not collapse onto /projects.
    expect(dashboardCreditsHref([P, "other-id"], "completed")).toBe(
      `/projects/${P}/credits?filter=completed`,
    );
    expect(dashboardCreditsHref([P, "other-id"], "in_progress")).toBe(
      `/projects/${P}/credits?filter=in_progress`,
    );
    expect(dashboardCreditsHref([P, "other-id"], "missing_evidence")).toBe(
      `/projects/${P}/credits?filter=missing_evidence`,
    );
  });

  it("falls through to the workspace Credits resolver with no projects", () => {
    expect(dashboardCreditsHref([], "completed")).toBe(
      "/credits?filter=completed",
    );
  });
});

describe("searchParamsQuery", () => {
  it("forwards a filter so the workspace Credits URL keeps its meaning", () => {
    expect(searchParamsQuery({ filter: "in_progress" })).toBe(
      "?filter=in_progress",
    );
  });

  it("is empty when there is nothing to forward", () => {
    expect(searchParamsQuery()).toBe("");
    expect(searchParamsQuery({})).toBe("");
    expect(searchParamsQuery({ filter: undefined })).toBe("");
  });
});
