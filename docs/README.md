# NetZero — Product & Research Docs

Working docs for a green-building **certification compliance tracking** platform — Saudi Arabia's **Mostadam** first (LEED/BREEAM/WELL/EDGE later). It turns certification spec manuals into structured, trackable project checklists with a grounded AI assistant that answers "what's left / what's at risk" from the project's own data.

> Status (2026-08-16): **research + planning phase.** No app code written yet — Stage 1 build starts after the [open questions](./planning/open-questions.md) are resolved. The Next.js app scaffold at repo root is untouched.

## Start here
1. [Product Vision & Scope](./product/vision-and-scope.md) — the what/why/who, differentiation, staged scope.
2. [Open Questions](./planning/open-questions.md) — **decisions needed from the client before building** (read the P0s).
3. [MVP — Stage 1 Scope](./product/mvp-stage-1.md) — project creation + credit tracking + grounded AI assistant.

## Map

### `product/` — what we're building
- [vision-and-scope.md](./product/vision-and-scope.md) — vision, personas, value prop, principles, staged scope.
- [data-model.md](./product/data-model.md) — proposed architecture: catalog(template) vs project(instance), the requirement-grain checklist, `metric_type` (boolean/numeric/descriptive), derived scoring/tiers.
- [mvp-stage-1.md](./product/mvp-stage-1.md) — detailed Stage-1 scope, the aggregator-AI spec, acceptance criteria, risks.

### `planning/` — how & when
- [roadmap-and-sprints.md](./planning/roadmap-and-sprints.md) — draft sprint plan (Sprint 0–6), post-MVP roadmap.
- [open-questions.md](./planning/open-questions.md) — P0/P1/P2 clarifications + working assumptions.

### `research/` — the evidence base
- **Domain (Mostadam):**
  - [mostadam-overview.md](./research/domain/mostadam-overview.md) — schemes, tiers (Green→Diamond), workflow, roles, category codes (E/W/HC/SS/TC/PMM/MW/RC/EI). *From the primary 2019 manuals.*
  - [mostadam-credit-anatomy.md](./research/domain/mostadam-credit-anatomy.md) — ⭐ the credit/requirement data-shape deep dive with verbatim worked examples (E-01, W-01, HC-04, PMM-02, TC-02). Drives the data model.
- **Competitors:**
  - [green-badger.md](./research/competitors/green-badger.md) — the US LEED-tracking reference: modules, workflow, UX lessons, gaps.
  - [landscape.md](./research/competitors/landscape.md) — adjacent tools (LEED Online, Arc, EC3, One Click LCA, etc.).
- **Reference app (client-shared prototype):**
  - [sustainiq-ui-analysis.md](./research/reference-site/sustainiq-ui-analysis.md) — full teardown of the "SustainIQ" Figma prototype: IA, every screen, the 7-step create wizard, the credit/checklist model, the AI assistant.
  - [screenshots/](./research/reference-site/screenshots/) — captured UI (login, dashboard, projects, credits table, credit detail, project detail, AI assistant, create wizard, and all nav screens).

## Key facts locked from research
- **HC-10 = Indoor Air Quality** (Mostadam **Commercial** D+C). Credit codes are **only unique within (scheme, stage)** — always key by (scheme, stage, code).
- **Tiers:** Green / Bronze / Silver / Gold / Diamond, thresholds vary by scheme+stage+scope (Residential 20/35/50/65/80 on 100 pts; Commercial 25/45/65/85/105 on 130 pts).
- **Checklist grain = the requirement**, not the credit. Each requirement is BOOLEAN, NUMERIC (banded or single-threshold), or DESCRIPTIVE — matching the client's "boolean / range / free-text" ask exactly.
- **Scores & tiers are derived**, never self-reported.
</content>
