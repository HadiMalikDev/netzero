# MVP — Stage 1 Scope

**Goal:** A team can create a project against a Mostadam rating system, track its credits/requirements to a derived status & projected tier, upload evidence, and ask a grounded AI assistant "what's left / what's at risk" — answered only from the project's own data with citations.

This is the "project creation + dumb (aggregator) AI assistant" stage the client named.

---

## In scope

### 1. Accounts & workspace
- Email/password auth, **multi-tenant** (each company is an isolated org/workspace), users with roles, departments (the wizard's discipline list). Data isolation enforced from day one; billing deferred.
- RBAC: who can edit which credits (by department/ownership). Keep simple for MVP (admin / member).

### 2. Rating-system catalog (seed data) ⭐
- Curate at least **one full Mostadam catalog** end-to-end so tracking is real, not a stub. Recommended first: **Mostadam Commercial D+C (2019), Full Scope** (contains the client's `HC-10` example) and/or **Residential O+E (2019)**.
- Catalog = categories → credits → requirements (with `metric_type`, points, `scoring_bands`/`threshold_pass`, evidence specs). Authored via seed/admin tooling.
- **This is the biggest content task** — it's data entry from the manual, partially scriptable. See open questions on how many schemes to seed for launch.

### 3. Project creation wizard (adapted from reference)
Reference has 7 steps: General Info → Certification → Buildings → Departments → Team → Milestones → Review. For MVP keep the flow but:
- **Certification step selects a Mostadam `rs_version`** (scheme + stage + scope), which instantiates the catalog into `project_credit` + `requirement_entry` rows.
- Buildings/Team/Milestones can be minimal (or deferred) if timeline is tight — General Info + Certification + Departments are the must-haves.

### 4. Credit & checklist tracking (the core)
- **Credits table** per project/track: name, category, points (earned/max), status, owner, due date, compliance %, risk — with filters (All/Completed/In Progress/Under Review/Not Started) and search. (Mirrors reference.)
- **Credit detail** with **Requirements Checklist** rendering each requirement by its `metric_type`:
  - `BOOLEAN` → checkbox.
  - `NUMERIC` → value input + unit, live-evaluated against bands/threshold to show points.
  - `DESCRIPTIVE` → artifact upload + content sub-checklist.
- Assign owner + responsible departments; set due date; attach **evidence** (typed artifacts).
- **Derived rollups**: credit points, track score, projected/achieved tier, keystone completeness.

### 5. Status rollups / dashboards
- **Project overview**: certification score vs target tier, credits addressed, open/overdue tasks, credit-status donut, keystone status, department performance, timeline.
- **Portfolio dashboard**: KPIs across projects (active projects, credits completed, open tasks, pending reviews) + attention banner (overdue).

### 6. Grounded AI assistant ⭐ (the "dumb"/aggregator AI)
An **AI search/aggregation agent over the project's own data** — retrieves + summarizes + ranks; **never invents credits or requirements**; always cites the underlying credit/requirement/task/document.

**MVP capabilities (aggregation only):**
- "What's remaining / what's left?" → open credits & requirements, grouped, ranked by impact/deadline.
- "What's missing to reach Gold?" → point gap to next tier + the specific highest-value open credits/requirements that close it (arithmetic over catalog points, not prediction).
- "What documents are missing?" → requirements whose required evidence isn't attached.
- "What's overdue / at risk?" → overdue tasks, high-risk credits, unmet keystones.
- "What's the status of credit HC-10 / the Energy category?" → scoped rollup.

**Deferred to Stage 3 (generative):** submission-narrative writing, free-form score *prediction* beyond deterministic point arithmetic, document Q&A over external standards.

**Design notes:**
- Implement as **retrieval over structured project data** (query the DB / a computed project-state object) + an LLM that formats and explains — with a tool/function layer returning facts. The LLM's job is phrasing and ranking, not sourcing truth.
- **Every answer carries citations** (links to the exact credit/requirement/doc). If data doesn't support an answer, it says so — no fabrication.
- Guardrail tests: it must refuse to invent a requirement or a point value not in the catalog.
- See [`../research/reference-site/sustainiq-ui-analysis.md`](../research/reference-site/sustainiq-ui-analysis.md) §9 for the reference's (broader) assistant, and consciously scope down.

### 7. Evidence/document storage
- Upload + store typed evidence per requirement; list/preview; mark review status. (Full submission-package export is Stage 2.)

---

## Explicitly out of scope for Stage 1
- **Document ingestion / spec parsing** (upload HC-10 PDF → auto-derive checklist) → **Stage 2**. MVP setup is catalog-driven. *(Confirm with client — see open questions; this is the item most likely to be re-prioritized.)*
- Submission-package export to a certifier; authority integrations.
- Subcontractor loginless submission, mobile capture.
- Generative narratives / predictive scenarios.
- Multi-standard catalogs (LEED/BREEAM/WELL/EDGE) — architecture ready, content later.
- Arabic/RTL localization.

## Acceptance criteria (Stage 1 "done")
1. A user can create a project, pick a Mostadam `rs_version`, and see the correct credits/requirements instantiated.
2. Requirements of all three `metric_type`s render and evaluate to points correctly (verified against E-01 bands, W-01 %, HC-04 threshold, a DESCRIPTIVE credit).
3. Credit/track score and achieved/projected tier compute correctly, respecting keystone rules.
4. Evidence can be attached to a requirement and shows in the credit detail.
5. Dashboard/overview rollups match the underlying data.
6. The AI assistant answers the five MVP query types **with citations** and **refuses to fabricate**; passes the guardrail tests.

## Key risks
- **Catalog data-entry effort** (accuracy of points/bands/evidence from a 269-page manual) — largest effort/risk; needs a verification pass.
- **Mostadam Credit Tools** (Energy/Water Tool) may hide exact band math → some NUMERIC scoring may need approximation or the actual tool spreadsheets (open question).
- **Scope creep from document ingestion** — keep it Stage 2 unless client insists it's MVP-critical.
</content>
