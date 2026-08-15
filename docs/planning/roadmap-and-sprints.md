# Roadmap & Sprint Plan (DRAFT)

> **Status: draft, pending client answers** in [`open-questions.md`](./open-questions.md). Sprint contents (esp. whether document ingestion is in MVP, and how many Mostadam schemes to seed) will shift based on those answers. Estimates assume a small team (≈1–2 engineers + design) and 2-week sprints; adjust to actual capacity.

## Guiding sequence
Foundation → Catalog → Project creation → Tracking → Rollups → Grounded AI → polish. Everything downstream depends on a real seeded catalog, so it comes early.

## Tech context (already scaffolded)
Next.js 16 (App Router), React 19, Tailwind 4, TypeScript, pnpm. Backend/DB **to be decided** (see open questions — likely Postgres + an ORM; auth provider TBD).

---

### Sprint 0 — Foundations (1 sprint)
- Decide & wire: database (Postgres?), ORM (Prisma/Drizzle?), auth (NextAuth/Clerk/Supabase?), file storage (S3-compatible?), hosting.
- Base app shell: left-nav IA (Dashboard/Projects/Credits/Tasks/Documents/AI/Org/Settings), design tokens matching reference palette, responsive layout.
- **Multi-tenant** org + user + department models with enforced data isolation per workspace; email/password auth; basic RBAC (admin/member). *(Locked: multi-tenant SaaS.)*
- CI, linting, environment/config, seed-script harness.
**Exit:** logged-in empty shell with org/users/departments.

### Sprint 1 — Catalog engine + first Mostadam seed
- Implement catalog schema (`rating_system` → `rs_version` → category → credit → requirement → evidence_spec) with `metric_type`, `scoring_bands`, `threshold_pass`, tier thresholds.
- Build the **points-evaluation engine** (BOOLEAN / NUMERIC-banded / NUMERIC-threshold / DESCRIPTIVE) + tier/keystone logic, with unit tests against the manual's worked examples (E-01, W-01, HC-04).
- Seed **Mostadam Commercial D+C (2019), Full Scope** *(locked as first scheme)* via structured seed data; verification pass against the PDF.
**Exit:** a rating-system version fully represented and scoring correctly in isolation.

### Sprint 2 — Project creation + instantiation
- Project model + create wizard (General Info → Certification(rs_version) → Departments → [Buildings/Team/Milestones minimal]) → **instantiate catalog into project_credit + requirement_entry**.
- Projects list (cards + filters) and project overview skeleton.
**Exit:** create a project, pick Mostadam, see correct credits/requirements populated.

### Sprint 3 — Credit & checklist tracking (core)
- Credits table (columns, filters, search) + credit detail (Overview/Requirements tabs).
- Requirement inputs by `metric_type` with **live points evaluation**; owner/department assignment, due dates, risk.
- Evidence upload (typed artifacts) per requirement; status transitions; history/audit events.
**Exit:** a project's certification status is fully trackable and derived correctly end-to-end.

### Sprint 4 — Rollups & dashboards
- Project overview rollups (score vs target tier, credit-status donut, keystone status, department performance, overdue/tasks).
- Portfolio dashboard (KPIs + attention banner).
- Notifications (overdue, review-requested).
**Exit:** accurate portfolio + project status surfaces.

### Sprint 5 — Grounded AI assistant (aggregator)
- Project-state aggregation layer + tool/function API returning facts (open credits, point gaps to tiers, missing evidence, overdue/at-risk, credit/category status).
- Chat UI (scoped to a project) + quick actions for the 5 MVP query types.
- **Citations on every answer; guardrail tests that it refuses to fabricate.**
**Exit:** the "what's left / what's at risk" assistant works and is trustworthy.

### Sprint 6 — Hardening & MVP polish
- Evidence review flow, exports (CSV/PDF of credit status), empty/error states, accessibility, performance, seed a second scheme if in scope.
- UAT with a real Mostadam project; fix list.
**Exit:** Stage-1 MVP acceptance criteria met.

---

## Post-MVP (Stage 2+, not scheduled yet)
- **Stage 2:** Document ingestion (spec PDF → draft catalog for human review), submission-package export, task board/kanban, richer evidence workflows.
- **Stage 3:** Subcontractor loginless submissions, mobile evidence capture, generative assistant features (narratives, scenarios), multi-standard catalogs, Arabic/RTL, integrations, recertification tracking.

## Sequencing risks / notes
- If the client says **document ingestion is MVP-critical**, it inserts as a new sprint after Sprint 1 (it feeds the catalog) and pushes the timeline — flagged in open questions.
- Catalog seeding accuracy is the critical path; budget a dedicated verification pass, ideally with the client's AP reviewing.
</content>
