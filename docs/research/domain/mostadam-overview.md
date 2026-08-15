# Mostadam Green Building Rating System — Overview

> Research brief for the NetZero compliance-tracking product. Covers what Mostadam is,
> its rating schemes, certification tiers, the certification workflow, and the
> category/credit code scheme. The credit/metric **data-shape deep dive** lives in the
> companion file `mostadam-credit-anatomy.md`.
>
> Primary sources are the official Mostadam manuals (2019). Where a fact comes from a
> consultant/secondary source it is marked *(secondary)*. See **Sources** and
> **Confidence & gaps** at the bottom.

---

## 1. What Mostadam is

- **Name.** *Mostadam* (مستدام, Arabic for "sustainable") is Saudi Arabia's national
  green-building rating and certification system.
- **Developed / operated by.** The manuals credit development to **"Sustainable Building"**
  (the implementing body that trains/licenses assessors and issues certificates). The
  program sits under the **Ministry of Municipal, Rural Affairs and Housing (MoMRAH)**
  *(secondary; consistently reported across consultant sources and the official portal)*.
- **Purpose.** "A comprehensive sustainability rating and certification system to address
  the long-term sustainability of … buildings in the Kingdom of Saudi Arabia" — spanning
  energy, water, health/comfort, materials/waste, site, transport, and management
  (verbatim intent from both the Residential O+E and Commercial D+C manuals).
- **Launched.** Manuals are marked **VERSION 2019** (© 2019 Sustainable Building). 2019 is
  the effective launch of the current rating-system generation.
- **Relation to Saudi Vision 2030.** Explicitly derived from Vision 2030. The manuals state
  the criteria "have been informed by the goals and objectives contained in Vision 2030,"
  which is built around three themes: **A Vibrant Society, A Thriving Economy, An Ambitious
  Nation.** Each manual opens with a figure mapping Mostadam credits to Vision 2030 goals.
- **Relation to the Saudi Building Code.** Mostadam is aligned with the **Saudi Green
  Building Code (SgBC 1001 / SBC 1001 – Green Construction Code)**, which sets *minimum*
  mandatory standards; Mostadam is the *above-minimum* voluntary rating layer that sits on
  top of it. Individual credits cite specific SBC parts (e.g. SBC 601/602 for energy,
  SBC 1001 §807 for acoustics).
- **Mandatory vs. voluntary.** **Voluntary in general**, but effectively **mandatory for
  large government/public projects** *(secondary: several consultants cite a threshold
  around government buildings > 5,000 m²; treat the exact threshold as unverified)*.
- **Relationship to building permits.** No source confirms Mostadam certification is a
  *prerequisite* for a building permit. It is a separate sustainability rating coordinated
  with — but not gating — the permit process. The mandatory minimums that *do* gate permits
  live in the SgBC/SBC, not in Mostadam. **(Flag as uncertain.)**

---

## 2. Rating systems / schemes

Mostadam is a **family** of rating systems, split first by **building use** and then by
**lifecycle stage**.

### By building use

| Scheme | Scope | Notes |
|---|---|---|
| **Mostadam for Residential Buildings** | Homes — both **individual dwellings** (villas) and **multi-residential** buildings (apartment blocks) | The residential manual carries *both* typologies through every credit, often with different point rules per typology. |
| **Mostadam for Communities** | Master-planned developments / neighbourhood-scale infrastructure | Separate manual; 100-point scale *(secondary)*. |
| **Mostadam for Commercial Buildings** | Offices, retail, education, healthcare, warehouses, mosques, hospitality — **7 building typologies** | 130-point scale; adds Region & Culture category. |

### By lifecycle stage (applies within a scheme)

- **D+C — Design + Construction.** Assessed at design and again at construction completion.
- **O+E — Operation + Existing.** Assessed after the building has been operating; focuses on
  measured performance, policies, and maintenance. Requires a **1-year Monitoring Period**
  at **≥ 75% occupancy** before it can be certified.

> The two primary documents used for this research are the **Residential Buildings O+E
> Manual (2019)** and the **Commercial Buildings D+C Manual (2019)**.

---

## 3. Certification levels / tiers

Five named tiers, awarded by **total points accumulated**. The scale and thresholds differ
by scheme.

### Residential (100-point scale)

| Points achieved | Rating level |
|---|---|
| ≥ 20 | **Green** |
| ≥ 35 | **Bronze** |
| ≥ 50 | **Silver** |
| ≥ 65 | **Gold** |
| ≥ 80 | **Diamond** |

- **Green** is reached automatically by completing the **12 Keystone (mandatory) credits**,
  which are worth exactly **20 points**. Higher tiers require the Keystone credits **plus**
  enough optional-credit points to clear the next threshold.

### Commercial (130-point scale, Core-and-Shell / Full Scope)

| Points achieved | Rating level |
|---|---|
| ≥ 25 | **Green** |
| ≥ 45 | **Bronze** |
| ≥ 65 | **Silver** |
| ≥ 85 | **Gold** |
| ≥ 105 | **Diamond** |

- Commercial **Green** = achieving all keystone credits (**25 points** for Full Scope /
  Core-and-Shell).
- **Scope-dependent thresholds.** Commercial certification can be pursued at four scopes,
  each with its own total and thresholds (Commercial D+C Manual, Table 2):

  | | Shell only | Core & Shell | Fit-Out | Full Scope |
  |---|---|---|---|---|
  | **Total points available** | 35 | 130 | 100 | 130 |
  | Green | ≥ 10 | ≥ 25 | ≥ 20 | ≥ 25 |
  | Bronze | ≥ 15 | ≥ 45 | ≥ 35 | ≥ 45 |
  | Silver | ≥ 20 | ≥ 65 | ≥ 50 | ≥ 65 |
  | Gold | ≥ 25 | ≥ 85 | ≥ 65 | ≥ 85 |
  | Diamond | ≥ 30 | ≥ 105 | ≥ 80 | ≥ 105 |

**Data-model takeaway:** the tier is a **derived value** = the highest threshold whose point
floor is `≤ SUM(points earned)`. Thresholds are **per (scheme, lifecycle-stage, scope)**, so
model them as configurable rows, not constants.

---

## 6. What a "specification document" / submittal looks like, and the workflow

### The credit template (what a consultant fills in)

Each credit in the manual is effectively a **spec sheet / template**. The consultant does not
free-write; they respond to a fixed structure (full anatomy in `mostadam-credit-anatomy.md`):
credit code + title, whether it is Keystone, points available, **Aim**, a numbered
**Requirements** table (each row = one checkable sub-requirement with its own point value),
an **Evidence** table (documentation required *per requirement*), **Supporting Guidance**,
an optional **Credit Tool** (a Mostadam-provided calculator spreadsheet, e.g. the *Energy
Tool* / *Water Tool*), and **Reference Documents**.

**A submission package** therefore bundles, per targeted credit: the filled-in credit
tool(s), plus the listed evidence — typically **scaled plans/drawings, date-stamped
photographs, manufacturer datasheets, meter readings/utility bills, professional CVs, test
reports (e.g. ASTM acoustic tests), and written Owner commitment letters**. O+E credits
additionally require **policies/procedures** (e.g. Waste Diversion Operational Procedure,
Sustainable Procurement Policy) that must be *developed in the first 6 months and implemented
for ≥ 6 months* of the Monitoring Period.

A typical **policy/procedure document** has this fixed table of contents (Residential O+E
Fig. 5): Content Page · Aims and Objectives · Roles and Responsibilities · Implementation
Guidance · Procedure · Communication (multi-residential) · Training (multi-residential) ·
Records · Sign-off and Management Overview.

### The certification workflow

**D+C path (design & build):**

1. **Register the project** with Mostadam / Sustainable Building.
2. **Appoint the Mostadam Accredited Professional (AP)** — the single channel for all
   communication with the assessor.
3. **Submission 1 — after detailed design** → reviewed → **Design Rating Certificate**.
4. **Submission 2 — after construction completion** (includes a **Site Audit Visit**) →
   reviewed → **Construction Rating Certificate**.

**O+E path (operation of an existing building):**

5. **Monitoring Period** — operate ≥ 1 year at ≥ 75% occupancy; record energy, water and
   waste **monthly**; develop & implement required policies/procedures.
6. **Submission 3 — after the monitoring year** (includes a **Site Audit Visit**) →
   reviewed → **Operational Rating Certificate**.
7. **Recertification** — O+E certificates must be **re-assessed at least every 5 years**;
   the assessor pulls random samples of ongoing documentation.

**Key roles (Residential O+E, Table 4):**

- **Sustainable Building** — implementing body; trains/licenses APs & Assessors; issues
  certificates; answers formal credit queries.
- **Mostadam Assessor** — appointed by Sustainable Building; reviews each submission;
  conducts Site Audit Visits.
- **Mostadam Accredited Professional (AP)** — the client-side expert; QAs all credit
  evidence and is the *sole point of contact* with the Assessor.
- **Client / Owner** — appoints the AP early, pays fees, supports the process.
- Plus specialist consultants invoked by specific credits: **Energy Auditor, Building
  Envelope Auditor, Acoustic Engineer / Professional, Mechanical Engineer (TAB),
  Environmental Professional**, Facilities/Operations team, End Users.

---

## 7. Category prefixes / code scheme

Credit IDs follow **`<CATEGORY-PREFIX>-<two-digit number>`** (e.g. `HC-10`, `E-01`,
`PMM-02`). The number is a **stable position within the category**, not the point value.

| Prefix | Category | In Residential O+E | In Commercial D+C |
|---|---|---|---|
| **PMM** | Policies, Management & Maintenance | ✅ (PMM-01…06) | ✅ (PMM-01…04) |
| **E** | Energy | ✅ (E-01…07) | ✅ (E-01…07) |
| **W** | Water | ✅ (W-01…04) | ✅ (W-01…04) |
| **HC** | Health & Comfort | ✅ (HC-01…09) | ✅ (HC-01…16) |
| **EI** | Education & Innovation | ✅ (EI-01…04) | ✅ (EI-01…03) |
| **SS** | Site Sustainability | ✅ (SS-01…03) | ✅ (SS-01…07) |
| **TC** | Transportation & Connectivity | ✅ (TC-01…04) | ✅ (TC-01…05) |
| **MW** | Materials & Waste | — *(in Residential this content sits under PMM / HC)* | ✅ (MW-01…07) |
| **RC** | Region & Culture | — | ✅ (RC-01…03) — commercial-only |

> **Correction to the initial guess:** Energy is **`E-`** and Water is **`W-`** (single
> letter), **not** `EN` / `WA`. **`HC` = Health & Comfort** is correct — e.g. commercial
> **`HC-10` = Indoor Air Quality**. Category numbering is **scheme-specific**: the same code
> can map to different titles across schemes (e.g. residential `HC-04` = *Acoustics* but
> commercial `HC-04` = *Water Quality*). **Always key a credit by (scheme, stage, code), not
> code alone.**

---

## Sources

- **Mostadam Rating System — Residential Buildings O+E Manual, VERSION 2019** (primary; full
  180-page PDF analysed): https://kh.aquaenergyexpo.com/wp-content/uploads/2023/10/Mostadam-Rating-System.pdf
- **Mostadam for Commercial Buildings (D+C) Manual, VERSION 2019** (primary; official Saudi
  gov Bluvalt-hosted, 269-page PDF analysed):
  https://subdivision-prod.ruh-s3.bluvalt.com/s3fs-public/mostadam/2024-05/Mostadam%20for%20Commercial%20Buildings%20(D+C).pdf
- Official portal: https://mostadamksa.org/
- Alpin Limited — Mostadam overview *(secondary)*: https://www.alpinme.com/mostadam-saudi-arabia/ and https://www.alpinme.com/mostadam/
- Conserve Solutions — levels/credits/process *(secondary)*: https://www.conservesolution.com/blog/mostadam-certification/
- EnviroLink — communities, process, mandatory status *(secondary)*: https://www.envirolink.me/mostadam-rating-system-for-communities/
- MDPI (Sustainability 2021, 13(2):793) — Mostadam & Vision 2030 academic framing *(secondary)*: https://www.mdpi.com/2071-1050/13/2/793

## Confidence & gaps

- **High confidence** (from primary manuals): tier names & point thresholds (residential &
  commercial), the 5-tier structure, category prefixes, Keystone concept, credit template
  anatomy, workflow stages/roles, Monitoring Period rules, scope-based commercial thresholds.
- **Medium confidence** *(secondary only)*: MoMRAH as governing ministry; "mandatory for
  government buildings > 5,000 m²"; Communities scheme being a 100-point scale.
- **Gaps / unverified:**
  - Whether Mostadam certification is ever a formal **building-permit prerequisite** — not
    confirmed by any source; likely *not* (permits are gated by SgBC minimums).
  - **Residential per-category point weightings** as a single published table — the O+E
    manual scores credit-by-credit (100-pt scale) rather than publishing fixed category caps;
    see the credit-anatomy file for the credit-count breakdown actually confirmed.
  - Exact current **version** in force in 2026 (manuals analysed are the 2019 editions; newer
    revisions may exist on mostadamksa.org).
  - The **Communities** manual credit codes/categories were not opened in full for this pass.
