# Correction — Stage 1 is over-scoped

**Date:** 2026-08-16  
**Status:** overlay only. Does **not** edit or replace any existing doc. Read this *after* the research pack; treat locked P0s and the Sprint 0–6 plan as **proposals, not decisions**.

Existing pack (left as-is): [`../README.md`](../README.md), [`../product/`](../product/), [`../planning/`](../planning/), [`../research/`](../research/).

---

## Verdict

Research direction is right. Planning is overbuilt.

The original brief was: research online + study the Figma prototype in a browser → store findings in `docs/` (split files) → **ask clarifying questions** → then plan. The pack did the research well, then skipped the ask and **locked** a 7-sprint Green Badger clone as Stage 1.

---

## What is on the right track (keep)

- Mostadam is the right first standard; **HC-10 = Indoor Air Quality** in **Commercial D+C**.
- Checklist grain is the **requirement**, not the whole credit.
- Value types **boolean / numeric (range or threshold) / free-text (descriptive)** match the brief.
- Assistant = **grounded aggregator** (“what’s left / what’s missing”) over project rows — not a generator.
- Catalog (template) vs project (instance) is the right *eventual* architecture.
- Figma prototype teardown in [`../research/reference-site/sustainiq-ui-analysis.md`](../research/reference-site/sustainiq-ui-analysis.md) is a useful UX reference, not a spec to clone 1:1.
- Docs are split; not one giant markdown.

---

## What is overcomplicated (do not treat as locked)

### 1. P0s marked resolved without the client

[`../planning/open-questions.md`](../planning/open-questions.md) marks these as locked:

1. Catalog-first; document upload = Stage 2  
2. First scheme = Commercial D+C, seed it fully  
3. Mostadam-only at launch  
4. Multi-tenant SaaS from day one  

The brief said the opposite last step: ask first. These stay **open**.

### 2. Upload-a-spec was the stated first-stage path

The brief: create a project, **upload a spec such as HC-10**, derive department metrics, build a checklist, track status.

Catalog-first is a fair *recommendation* (PDF parse is messy). Pushing upload to Stage 2 and locking it is not.

### 3. Stage 1 ballooned past “project + dumb assistant”

The brief’s first stage: project creation + an aggregator that answers “what’s remaining / what’s left.”

[`../product/mvp-stage-1.md`](../product/mvp-stage-1.md) and [`../planning/roadmap-and-sprints.md`](../planning/roadmap-and-sprints.md) also pull in:

- Multi-tenant orgs, RBAC, departments  
- Seeding the entire Commercial D+C catalog (~269 pages)  
- Points engine, keystones, tier math  
- Full 7-step wizard (buildings, team, milestones)  
- Portfolio dashboard, notifications, evidence review, CSV/PDF export  
- Seven 2-week sprints  

That is a certification OS. It is not the first slice.

### 4. Data model is production schema too early

[`../product/data-model.md`](../product/data-model.md) is a reasonable *later* shape. It is too much to freeze before one credit works end-to-end.

### 5. Adjacent research that does not help Stage 1

EC3, One Click LCA, ESG clouds, Green Badger barcode / Procore / pricing — keep as background; do not drive v1.

### 6. HC-10 itself was never extracted

Worked examples in [`../research/domain/mostadam-credit-anatomy.md`](../research/domain/mostadam-credit-anatomy.md) are **Residential O+E** (E-01, W-01, HC-04, …). The named credit is missing. Extract is below.

### 7. Figma treated as the product

Adopt IA/UX patterns. Do not take Task Board, Reports, Users, Departments, Notifications, and the 7-step wizard as Stage 1 requirements.

---

## HC-10 is public — not a standalone PDF

There is no `HC-10.pdf`. **HC-10 is pp. 180–182** of the official Commercial D+C manual (2019):

https://subdivision-prod.ruh-s3.bluvalt.com/s3fs-public/mostadam/2024-05/Mostadam%20for%20Commercial%20Buildings%20(D+C).pdf

Same family, also public:

- Commercial O+E: https://subdivision-prod.ruh-s3.bluvalt.com/s3fs-public/mostadam/2024-05/Mostadam%20for%20Commercial%20Buildings%20(O%2BE).pdf  
- Addendum (2023-11-15): https://subdivision-prod.ruh-s3.bluvalt.com/s3fs-public/mostadam/2024-05/Mostadam%20addendum%202023.pdf  

Same code, different meaning by scheme (this is why “key by scheme + stage + code” is correct):

| Manual | HC-10 means |
|---|---|
| Commercial D+C | Indoor Air Quality |
| Commercial O+E | Water Quality |
| Residential D+C (addendum) | Outdoor Space |

### Commercial D+C — HC-10 Indoor Air Quality (verbatim shape)

- **Keystone:** No  
- **Points:** 3 total (req 1 = 1 pt, req 2 = 2 pts)  
- **Aim:** Minimize construction IAQ impact; test air before occupancy.

| # | Requirement | Pts | Value type |
|---|---|---|---|
| 1 | IAQ Management Plan during construction + building flush-out (SMACNA; 2 ACH; after TAB + finishes) | 1 | Descriptive / boolean — plan exists, listed controls done, flush-out evidenced |
| 2 | Specialist IAQ test of occupied areas after construction, before occupancy | 2 | Numeric thresholds (Table HC-10.1) |

**Table HC-10.1 — max concentrations**

| Contaminant | Limit |
|---|---|
| Formaldehyde | 27 µg/m³ |
| PM2.5 | 15 µg/m³ |
| PM10 | 150 µg/m³ |
| TVOC | 500 µg/m³ |

**Evidence (design):** specs/contracts requiring the plan + flush-out; specs requiring specialist testing.  
**Evidence (construction):** IAQ plan + controls; filled IAQ checklist + dated photos; flush-out report (duration + outdoor air); test report (method, samples, concentrations, remedies); tester company profile (≥ 3 years GCC, similar scale).  
**Credit Tool:** N/A.

This one credit already needs boolean / descriptive / numeric-threshold inputs. It is enough to prove the product.

---

## Recommended Stage 1 (thin loop)

Do this instead of Sprint 0–6 until the questions below are answered:

1. Create a project (name, type, location is enough).  
2. Attach a spec — start with **hand-entered HC-10** (or a few HC credits). Upload/parse can be the next slice, not a blocker.  
3. Render the checklist with the three input types.  
4. Derive status from those values.  
5. Ask “what’s left / what’s missing / what’s overdue” and answer **only from that project’s rows**, with citations.

Out of this slice: multi-tenant, full 130-point seed, 7-step wizard, portfolio dashboard, exports, Arabic/RTL, generative AI.

---

## Questions that should have been asked (still open)

**Product**

1. For v1, is **upload PDF → derive checklist** required, or is a **pre-built catalog** (starting with HC-10) acceptable if upload follows?  
2. First slice: **one credit (HC-10)**, **Health & Comfort only**, or the **whole Commercial D+C** catalog?  
3. Internal tool for one firm, or multi-company SaaS from day one?  
4. English-only for v1, or Arabic/RTL at launch?

**If available from the client**

5. One anonymized real project (target tier, credits pursued, sample evidence).  
6. Edit access to the real Figma, not only the published prototype.  
7. Launch date and who is building.

---

## How to use this file

- Do not rewrite the existing pack to match this unless asked.  
- Do not start app work from [`../planning/roadmap-and-sprints.md`](../planning/roadmap-and-sprints.md) as written.  
- Next planning pass should start from the thin loop + the open questions above.
