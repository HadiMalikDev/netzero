# Mostadam — Credit Categories & Credit Anatomy (data-model deep dive)

> This file is the one that directly drives our data model. It answers:
> (4) what the credit **categories** are and how they're weighted, and
> (5) the **anatomy of a single credit** — its fields, and whether compliance is
> **boolean / numeric-threshold / descriptive** — with concrete verbatim examples.
>
> Source system for the worked examples: **Mostadam for Residential Buildings O+E Manual
> (2019)**, cross-checked against the **Commercial Buildings D+C Manual (2019)**. See the
> companion `mostadam-overview.md` for schemes, tiers, workflow, and the full prefix table.

---

## 4. Credit categories

### Residential O+E — 7 categories

| Prefix | Category | Credits (confirmed from manual TOC) |
|---|---|---|
| **PMM** | Policies, Management & Maintenance | 6 — PMM-01 Annual Audit · PMM-02 Residential Waste Management · PMM-03 Sustainable Maintenance & Servicing · PMM-04 Sustainable Procurement · PMM-05 Building Performance Monitoring · PMM-06 Hygienic Operations |
| **E** | Energy | 7 — E-01 Energy Performance · E-02 Energy Metering · E-03 Envelope Assessment · E-04 Renewable Energy · E-05 Energy Efficient Appliances · E-06 Ozone Impact · E-07 Demand Response Capability |
| **W** | Water | 4 — W-01 Water Performance · W-02 Water Metering · W-03 Water Efficient Products & Systems · W-04 Alternative Water Solutions |
| **HC** | Health & Comfort | 9 — HC-01 Outdoor Thermal Comfort · HC-02 Indoor Thermal Comfort · HC-03 Daylight & Visual Comfort · HC-04 Acoustics · HC-05 Ventilation · HC-06 Indoor Air Quality · HC-07 VOCs & Low-Emitting Materials · HC-08 Non-Polluting Insulation Materials · HC-09 Access for All |
| **EI** | Education & Innovation | 4 — EI-01 Mostadam Guide · EI-02 Occupant Engagement · EI-03 Regional Focus · EI-04 Innovation |
| **SS** | Site Sustainability | 3 — SS-01 Ecological Management & Enhancement · SS-02 Heat Island Effect · SS-03 Light Pollution |
| **TC** | Transportation & Connectivity | 4 — TC-01 Travel Plan · TC-02 Home Office · TC-03 Electric Vehicle Provisions · TC-04 Individual Sustainable Transport |

- **Scale:** 100 points total; tiers at 20/35/50/65/80 (see overview).
- **Weighting note:** the O+E manual does **not** publish a fixed "category = N points" cap
  table; points live on individual requirements and roll up. The largest single credits are
  **E-01 Energy Performance (12 pts)** and **W-01 Water Performance (12 pts)** — energy and
  water are clearly the heaviest topics, consistent with secondary sources that call Energy,
  Water and Health & Comfort the priority categories.

### Commercial D+C — 9 categories (130-pt scale)

Same six "core" categories (SS, E, W, HC, MW, PMM) that contain keystone + optional credits,
plus three optional-only categories: **TC** (Transportation & Connectivity), **RC** (Region &
Culture — commercial-only), **EI** (Education & Innovation). Commercial adds **MW — Materials
& Waste** as its own prefix (MW-01…07) and expands **HC to 16 credits** (this is where the
user's example **`HC-10 = Indoor Air Quality`** comes from).

---

## 5. Anatomy of a single credit

### 5.1 The fixed field structure (every credit has these)

From the Residential O+E "Credit layout" (Fig. 4) and confirmed across all credits:

| Field | Meaning | Data-model role |
|---|---|---|
| **Credit reference & title** | e.g. `TC-02 Home Office` | `code` (unique per scheme+stage) + `title` |
| **Keystone?** | Yes / No — is it mandatory | `is_mandatory` boolean |
| **Total Points Available** | integer (0–12 observed) | `max_points` |
| **Aim** | 1–2 sentence intent | `intent` (free text) |
| **Requirements** | **numbered table**; each row = one sub-requirement with its own point value, sometimes split by typology (Individual dwelling vs Multi-residential) | **1-to-many `requirement` rows** — this is the real "checklist item" grain |
| **Evidence** | documentation required, **keyed to each requirement #** | **1-to-many `evidence` rows**, FK to requirement |
| **Supporting Guidance** | definitions, formulas, provision lists, scoring tables | reference text + lookup tables |
| **Credit Tool** | named Mostadam calculator (e.g. *Energy Tool*, *Water Tool*) or `N/A` | `tool_ref` (nullable) |
| **Reference Documents** | external standards (SBC, ASHRAE, ASTM, ISO…) | `references[]` |

> **Key modelling insight:** the atomic unit that our checklist should map to is the
> **Requirement row**, *not* the whole credit. A credit is a *group*; each requirement is an
> individually-pointed, individually-evidenced item. A credit's earned points =
> `SUM(points of the requirement rows the project satisfies)`, capped at `max_points`.
> Requirements can also vary by **building typology** (two point columns), so a requirement
> row needs a `typology_applicability` dimension (e.g. `individual` / `multi` / `both` /
> `N/A`).

### 5.2 How compliance is measured — three shapes (this is the crux)

Every requirement resolves to points, but the **evaluation logic** underneath comes in three
distinct shapes. Our generic metric type must cover all three:

| Shape | What it looks like | Points logic | Example |
|---|---|---|---|
| **A. Boolean (met / not met)** | "Do X." Provide the thing / take the action. | Fixed points if done, 0 if not. | HC-04 Acoustics; PMM-02 bins provided; E-01 req #1–#5 |
| **B. Numeric threshold / banded** | Measure a number, compare to thresholds → points scale up in bands. | Points = f(measured value) via a lookup table. | E-01 EUI benchmark bands; W-01 % water reduction |
| **C. Descriptive / procedural** | Develop & implement a policy/procedure, or meet qualitative provisions. | Points if the described artifact exists and meets listed contents. | PMM waste/procurement procedures; TC-02 "home office provisions" |

In practice a **single credit mixes shapes** — E-01 below has boolean requirements *and* a
numeric-banded one. So the shape lives on the **requirement**, not the credit.

**Recommended generic metric model:**

```
requirement {
  id
  credit_code                 // FK -> credit
  seq                         // requirement #
  text                        // the requirement statement
  metric_type                 // enum: BOOLEAN | NUMERIC | DESCRIPTIVE
  typology_applicability      // individual | multi | both | n/a
  max_points
  // BOOLEAN: satisfied = user attests + evidence attached
  // NUMERIC: capture value + unit, then evaluate against scoring_bands
  unit                        // e.g. "kWh/m2", "dB(A)Leq", "% reduction"  (nullable)
  scoring_bands []            // ordered [{ op:'<', value:120, points:7 }, ...] (NUMERIC only)
  threshold_pass              // single-threshold pass/fail for NUMERIC-as-boolean (nullable)
}
evidence {
  id
  requirement_id              // FK
  description                 // "12 months of electricity bills…"
  artifact_types []           // drawing | photo | datasheet | report | meter_reading | CV | letter | tool_output | policy_doc
}
```

This one shape (`metric_type` + optional `unit`/`scoring_bands`) is enough to represent the
whole system. The examples below show each shape populating it.

---

### 5.3 Worked examples (verbatim from the O+E manual)

#### Example 1 — `E-01 Energy Performance` — MIXED (boolean keystone reqs + NUMERIC band)

- **Keystone:** Yes · **Total points available:** 12
- **Aim:** "To reduce the environmental and economic impacts associated with excessive energy
  use … by assessing the operational energy use within the building against minimum operating
  energy performance levels."
- **Requirements (7 rows):**
  - Keystone block = achieve req #1–#4 (**4 pts**), each a **BOOLEAN** action worth 1 pt:
    #1 Energy Consumption Assessment (compute annual EUI from 12 months of bills), #2 Energy
    Audit by a Competent Professional, #3 implement all measures with payback < 6 years, #4
    external-lighting controls.
  - #5 Appliances/Processes — 1 pt, BOOLEAN (Owner commitment letters).
  - #6 **Energy Consumption Benchmarking — up to 7 pts, NUMERIC/BANDED.** Points awarded on
    measured **EUI (kWh/m²)** vs regional benchmarks (Table E-01.1):

    | EUI band | Annual energy consumption | Points |
    |---|---|---|
    | Band A+ | < 120 kWh/m² | **7** |
    | Band A | < 150 kWh/m² | 5 |
    | Band B | < 185 kWh/m² | 3 |
    | Band C | < 225 kWh/m² | 1 |
    | Band D | < 265 kWh/m² | 0 |
    | Band E | < 320 kWh/m² | 0 |
    | Band F | > 320 kWh/m² | 0 |

    with a published formula `EUI = annual building energy (kWh) / GIA (m²)`.
- **Evidence (examples):** 12 months of utility bills (first & last must be *actual*, not
  estimated), sub-meter photos, GIA drawings, the **Energy Tool** output, Competent
  Professional CV, asset register, SASO/Energy-Star datasheets, single-line diagram, Energy
  Audit Report, purchase receipts.
- **Credit Tool:** Energy Tool. **References:** SBC 601/602, ASHRAE 90.1-2013 / 90.2-2007.
- → **Data shape:** requirement rows #1–#5 = `BOOLEAN`; row #6 = `NUMERIC` with `unit=kWh/m²`
  and a 7-row `scoring_bands` table.

#### Example 2 — `W-01 Water Performance` — NUMERIC / graduated %

- **Keystone:** Yes · **Total points:** 12 · **Aim:** reduce indoor & outdoor water use and
  load on wastewater systems.
- **Requirements:** #1 (keystone, **4 pts**) indoor consumption **≥ 10% below baseline**; #2
  further indoor reduction, **points scale with % improvement** (Table W-01.1):

  | % reduction | Points |
  |---|---|
  | 10% | 4 |
  | 20% | 5 |
  | 30% | 6 |
  | 40% | 7 |
  | 50% | 8 |

  #3 outdoor/irrigation reduction vs midsummer baseline (up to 4 pts). Baseline is defined by
  a **max flow-rate table** (Table W-01.2), e.g. kitchen faucet 6.84 lpm @ 414 kPa, water
  closet 4.86 lpf, showerhead 7.6 lpm @ 552 kPa.
- **Credit Tool:** Water Tool (it computes % improvement and resulting points).
- → **Data shape:** `NUMERIC` with `unit=% reduction`, graduated `scoring_bands`; plus a
  reference lookup table of fixture baselines.

#### Example 3 — `HC-04 Acoustics` — BOOLEAN via a numeric pass/fail threshold

- **Keystone:** No · **Total points:** 1 · **Aim:** low ambient internal sound levels.
- **Single requirement:** on-site measurement must show internal ambient noise **< 35 dB(A)Leq
  in bedrooms** and **< 40 dB(A)Leq elsewhere** (individual dwelling); **< 35** in units and
  **< 45 dB(A)Leq** in common areas (multi-residential). Meet it → 1 pt; else remediate & re-test.
- **Evidence:** Acoustic Engineer CV, **field test reports per ASTM E336**, and (if failed) a
  remediation report + re-test reports.
- → **Data shape:** a single fixed-threshold check — model as `NUMERIC` with a
  `threshold_pass` (all-or-nothing 1 pt), i.e. the "NUMERIC-as-boolean" case. Confirms why the
  metric type needs both banded and single-threshold numeric modes.

#### Example 4 — `PMM-02 Residential Waste Management` — DESCRIPTIVE/procedural + BOOLEAN

- **Keystone:** Yes · **Total points:** 4 · **Aim:** reduce residential waste & divert from landfill.
- **Requirements:** #1 (keystone) develop & implement a **Residential Waste Operational
  Procedure** diverting **≥ 30%** of waste from landfill (DESCRIPTIVE artifact + a numeric
  target); #2/#3 provide **clearly labelled segregated bins** for named streams (BOOLEAN
  provision checks); #4 Advanced Diversion **≥ 50%** (2 pts, NUMERIC target); #5 organic
  composting procedure (DESCRIPTIVE + provision).
- → **Data shape:** mixes `DESCRIPTIVE` (a policy document must exist and contain listed
  contents) with `BOOLEAN` provision items and embedded `NUMERIC` diversion targets.

#### Example 5 — `TC-02 Home Office` — BOOLEAN with a provisions checklist

- **Keystone:** No · **Total points:** 1 · **Aim:** enable working from home to cut commuting.
- **Requirements:** #1 provide a home-office room/zone meeting listed provisions (adequate
  desk space; **two double power sockets**; data/telephone comms) — 1 pt; #2 (multi-residential
  only) display home-working benefit info in the lobby.
- **Evidence:** scaled plans showing office location/size, date-stamped photos of provisions,
  photo of the lobby information.
- → **Data shape:** `BOOLEAN`, but the "met" test is itself a **sub-checklist of provisions** —
  suggesting requirements may need optional nested `provision[]` acceptance criteria.

---

### 5.4 Summary of the data-shape findings

1. **Grain = Requirement, not Credit.** A credit is a container; each numbered requirement is
   an individually pointed, individually evidenced, individually typology-scoped item. Model
   the checklist item at requirement grain and roll points up to the credit and category.
2. **One metric_type enum covers everything:** `BOOLEAN`, `NUMERIC` (with `scoring_bands` for
   graduated points *and* a `threshold_pass` for single-threshold pass/fail), and
   `DESCRIPTIVE` (a policy/procedure artifact whose required contents are themselves a
   checklist).
3. **Points are almost never a single boolean at the credit level** — graduated numeric bands
   (E-01, W-01) mean earned points are a *function of a measured value*, so store the value +
   unit, not just a checkbox.
4. **Evidence is structured and per-requirement** — a fixed vocabulary of artifact types
   (drawing, photo, datasheet, report, meter reading, CV, commitment letter, tool output,
   policy document) covers essentially all credits; model it as an enum + attachments.
5. **Codes are not globally unique** — the same code (`HC-04`, `HC-10`) means different things
   across schemes/stages. Key every credit by **(scheme, stage, code)**.

---

## Sources

- **Mostadam Residential Buildings O+E Manual, VERSION 2019** (primary — all worked examples,
  tables E-01.1, W-01.1, W-01.2, and the credit-layout figure are transcribed from this PDF):
  https://kh.aquaenergyexpo.com/wp-content/uploads/2023/10/Mostadam-Rating-System.pdf
- **Mostadam for Commercial Buildings (D+C) Manual, VERSION 2019** (primary — category list,
  MW/RC prefixes, HC-10 = Indoor Air Quality, 130-pt scale):
  https://subdivision-prod.ruh-s3.bluvalt.com/s3fs-public/mostadam/2024-05/Mostadam%20for%20Commercial%20Buildings%20(D+C).pdf
- Official portal: https://mostadamksa.org/
- Conserve Solutions *(secondary, category priority framing)*: https://www.conservesolution.com/blog/mostadam-certification/

## Confidence & gaps

- **High confidence:** the credit-field anatomy, the three compliance shapes, and every worked
  example — all transcribed directly from the 2019 primary manuals (point values, thresholds,
  and tables quoted verbatim).
- **Medium confidence:** residential per-category *point caps* — the O+E manual scores at the
  requirement level and does not publish a category-cap table; credit *counts* per category are
  exact, per-category point totals are not stated as a single table.
- **Gaps:** Communities scheme credit list not fully enumerated here; whether the Mostadam
  Credit Tools (Energy/Water Tool spreadsheets) expose their scoring formulas publicly (they
  gate some NUMERIC scoring and would be worth obtaining for exact band math); possible
  post-2019 manual revisions on mostadamksa.org not reviewed.
