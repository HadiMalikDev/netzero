# Product Vision & Scope

## One-liner
A web platform that turns green-building certification specs (starting with Saudi Arabia's **Mostadam**) into structured, trackable project checklists — so teams stop passing spreadsheets and documents around and instead track certification status in one place, with a grounded AI assistant that answers "what's left, what's remaining, what's at risk" from the project's own data.

## The problem (today)
Certification compliance (Mostadam, and abroad LEED/BREEAM/WELL/EDGE) is tracked **manually**:
- Requirements live in long PDF manuals (e.g. the Mostadam Commercial D+C manual is ~269 pages).
- A consultant/AP transcribes credits into ad-hoc spreadsheets, chases evidence over email, and assembles submission packages by hand.
- Status is opaque: no single source of truth for "which credits are done, which points we've earned, which documents are missing, are we still on track for Gold."
- Evidence (drawings, photos, datasheets, meter readings, test reports, CVs, letters, tool outputs, policies) is scattered.

There is **no standardized web tool for this in Saudi Arabia.** In the US, **Green Badger** does a version of this for LEED (see [`../research/competitors/green-badger.md`](../research/competitors/green-badger.md)).

## Who it's for (initial personas)
- **Sustainability Manager / Mostadam Accredited Professional (AP)** — primary user. Owns the certification, QAs evidence, is the single channel to the assessor. Wants portfolio + per-project status and a fast answer to "what's outstanding."
- **Discipline leads (Architecture, MEP, Structural, Landscape, Waste, Electrical, Mechanical…)** — own the credits mapped to their department; update requirement values and upload evidence.
- **Project / Executive owner** — wants the rollup: score, projected tier, risk, deadlines.
- (Later) **Subcontractors / suppliers** — submit evidence (materials data, waste tickets) with minimal friction.

## Value proposition
1. **Spec → structured checklist.** Encode a rating system's credits/requirements once; instantiate per project instead of re-transcribing a PDF.
2. **Single source of truth for status.** Every credit/requirement has a state, owner, due date, points, evidence, and risk. Progress and projected tier are **derived, not self-reported**.
3. **Grounded AI aggregator.** Ask the project plain questions and get answers assembled *from the project's own data* with citations — not invented requirements.
4. **Audit-ready evidence.** Structured, per-requirement evidence with a fixed artifact vocabulary; export a submission package.

## Differentiation
- **Mostadam-native** (KSA-first), where Green Badger is LEED/US-first. Correct schemes, category codes (E/W/HC/SS/TC/PMM/MW/RC/EI), levels (Green→Diamond), and point thresholds — see [`../research/domain/`](../research/domain/).
- **Multi-shape checklist values** (boolean / numeric-banded / numeric-threshold / descriptive) modeled from the real manual structure — richer than the reference app's boolean-only checklist.
- **Explicit ownership, due dates, and task assignment** on top of the checklist (a noted Green Badger gap).
- **Grounded, cited AI** scoped to aggregation for MVP (trust over cleverness).
- **Document-ingestion assist** (upload a spec → parse toward a checklist) as a differentiator beyond catalog-only setup.

## Product principles
- **Derived over declared** — statuses/scores/tiers computed from evidence + requirement values, never a free-typed %.
- **Grounded over generative** — the assistant retrieves and aggregates; it cites; it does not invent credits or requirements.
- **Catalog is the backbone, documents are an assist** — a curated rating-system catalog is the reliable core; document parsing accelerates setup but is always human-reviewed.
- **Key by (scheme, stage, code)** — never assume a credit code is globally unique.

## Scope — staged
- **Stage 1 (MVP, this engagement's focus):** Project creation + credit/checklist tracking + status rollups + a grounded aggregator AI assistant. Detailed in [`mvp-stage-1.md`](./mvp-stage-1.md).
- **Stage 2 (fast-follow):** Document ingestion & parsing (spec → checklist), submission-package export, richer evidence workflows, task board/kanban.
- **Stage 3+:** Subcontractor loginless submissions, mobile evidence capture, generative features (submission narratives, predictive scenarios), multi-standard (LEED/BREEAM/WELL/EDGE) catalogs, Arabic/RTL, integrations (Procore/Autodesk), recertification tracking.

## Explicit non-goals for MVP
- No generative "write my submission narrative" or free-form score prediction (Stage 3).
- No official/authority integration or e-submission to Mostadam (export only).
- No mobile app (responsive web only).
- No multi-standard catalog beyond Mostadam at launch (architecture stays multi-standard-ready).

## Related docs
- Reference app teardown → [`../research/reference-site/sustainiq-ui-analysis.md`](../research/reference-site/sustainiq-ui-analysis.md)
- Domain (Mostadam) → [`../research/domain/mostadam-overview.md`](../research/domain/mostadam-overview.md), [`../research/domain/mostadam-credit-anatomy.md`](../research/domain/mostadam-credit-anatomy.md)
- Data model → [`./data-model.md`](./data-model.md)
- Open questions → [`../planning/open-questions.md`](../planning/open-questions.md)
</content>
