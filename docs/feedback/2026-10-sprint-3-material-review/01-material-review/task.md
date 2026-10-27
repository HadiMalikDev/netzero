# 1 — Material Review (SMQ)

**Type:** Feature · **Effort:** XL · Raised 2026-10-27 · Branch `feat/material-review`

## As raised

> The Material Review is the most important part of the monthly checklist. Material Review is
> done based on the Sustainability Material Questionnaire. … whenever we do the material review
> and we fulfill the section credit like for example, if the questionnaire has MW5 and we fulfill
> that part of the questionnaire, then when we go to MW5 we should also see that for this
> month's checklist, this is the value that we have added for the MW5 part of the checklist.
> Some requirements are fixed while some are project specific. … we also need to show a section
> that shows these monthly checklists so users can come and review both past checklists and
> this month's checklist.

Source documents (client, not committed): `start-data/` — SMQ Rev03 (Oceanarium), Appendix 8
Materials Review Process (tracker), Milestone 2 Requirements in Brief Rev03, the signed JOTUN
epoxy-flooring submittal MTS-0411, and the Sustainability Risk Register.

Hadi asked for a high-level discussion with online research first, then a plan in which every
ambiguity and every product, architecture or refactor decision was put to him and recorded
with all the options offered. That record is below (D1–D38).

Every decision below was put to Hadi (D1–D38, at the end, with all the options offered).
The **Choices I made** section lists the smaller calls I made myself; they are flagged for
approved with the plan on 2026-10-27.

## Context (why)

The client's Milestone 2 brief makes the Material Tracker the first part of the monthly
sustainability report, and Hadi calls it the most important part of the monthly checklist.
It is built on the client's SMQ (Sustainability Material Questionnaire): one questionnaire per
product, whose rows each target a credit (MW-05, HC-11 …).

The aim:
- Review every product against the SMQ.
- Count approved products toward the material credits.
- Show each month's reviews, current and past, on a Materials page, on each credit page and on
  the Reports page.

The client worries about a wrong material landing on the wrong credit, or a material being
missed. The JOTUN file shows this happens: Ceilings rows were filled for a floor primer. So the
SMQ ships as a curated default that each project then edits, rather than a blank form.

## The plan

### Data model (new tables, D17; `db/schema.ts` and migration `0016_material_review.sql`)

Template layer: the workspace default has `project_id` null and holds credit codes. A project's
own copy holds catalog credit ids (D1, D20, D35).
- `smq_template`
  - Columns: id, workspace_id, project_id (null = default, unique when set), title, revision.
  - Project settings live on the copy: `expiry_years` (default 3, D7) and
    `boq_material_cost_sar` (the RC-01 total, D14).
- `smq_section`
  - Columns: template_id, seq, kind (`all_materials` | `material_type`), heading (the material
    type name, e.g. "Paints & Coatings"), active.
  - `default_parts`: a JSON list of the calculated credit parts this type pre-ticks (D33).
- `smq_row`
  - Columns: section_id, seq, active, requirement text, `leed_ref` (text only, D2).
  - Credit link: `credit_code` in the default, `project_credit_id` in a copy. Null means
    unlinked or LEED-only.
  - `kind`: `fixed` | `project_value` | `design_package` | `construction_team` |
    `project_requirement`, taken from the SMQ's column-I notes.
  - `target_text`: the project value, shown next to the answer, with no automatic check (D21).
  - `value_unit`: optional.

Review layer (D11, D9):
- `material_submittal`: project_id, ref, title, discipline, supplier, submitted_on.
- `material_product`
  - Identity: submittal_id, `revision`, `previous_revision_id`, name ("Material Subject"),
    location_of_use, `interior` (D33), manufacturer, supplier, country_of_origin, contact
    name and mobile.
  - Review: `status` A|B|C|D|null (D6), `reviewed_on` YYYY-MM-DD (D26), reviewer (free text,
    D5), applicable, consultant remarks, the manufacturer and contractor sign-off names and
    dates (free text).
  - BOQ forecast quantities (D13, D25): `boq_weight_t`, `boq_volume_m3`, `boq_cost_sar`.
  - A revision is frozen once a newer revision exists.
- `material_product_type`: product ↔ smq_section, for the picked material types (D12).
- `material_product_part`: product ↔ calculated credit part, the ticks (D33).
- `material_answer`: one per row shown for the product.
  - It snapshots the row text, credit, target and kind when it's created, like
    `checklist_response`.
  - Answer columns: `answer` yes|no|na|null, `value`, `unit`, `remark` (D10).
- `material_delivery`: product_id, delivered_on, po_number, weight_t, volume_m3, cost_sar
  (D13, the actual).
- `material_answer_doc`: answer ↔ evidence_doc. The same file can then back a revision without
  being copied (see Choices).

Files refactor (D18), in `evidence_doc`:
- `project_credit_id` becomes nullable, and `material_product_id` and `issued_on` are added.
  `issued_on` is required on SMQ uploads (D27).
- A check constraint requires exactly one owner: a credit or a product.
- `slot`: submittal | boq | datasheet | filled_smq | null, for the product's named slots (D37).
- **Audit every consumer** of `evidenceDocs` so that none assumes a credit:
  - `lib/data.ts`, `lib/checklists.ts`, `lib/evidence.ts`
  - `lib/report/checklist.ts` (`creditPhotos`)
  - `app/(app)/projects/actions.ts` (`uploadEvidence`, `deleteEvidence`)
  - `inspection-actions.ts` (`savePhoto`)
  - the AI files under `lib/ai/*`
  - `app/api/evidence/[docId]/route.ts`, which is already scoped by workspace and must stay
    so for product files.
- Reuse the upload code: pull the duplicated disk-write in `uploadEvidence` and `savePhoto` into
  one helper in `lib/evidence.ts`, and use it for material files.

### Seed (D19, D36): `0017_seed_smq_rev03.sql`
- Converted once from the Rev03 workbook, using a script in the session scratchpad that reads it
  with the repo's `exceljs`. Only the SQL is checked in, like 0009 and 0011.
- Contents:
  - The "For all materials" section, plus one section per material type, with every row.
  - Mostadam codes go in `credit_code`; LEED codes in `leed_ref`.
  - `kind` comes from column I.
  - Targets are blank and the title neutral (D36).
  - `default_parts` is filled for the calculated types: All metals → MW-05 steel,
    Aggregate → MW-05 aggregates, Wood → MW-05 timber, and so on.
- Fixed ids with `ON CONFLICT DO NOTHING`.

### Project copy and its editor
- `ensureProjectSmq(projectId)` follows the pattern of `ensureProjectTemplate`
  (`lib/checklists.ts:192`). It copies the default and resolves each code once to that
  project's `project_credit` (D20). An unresolved code is kept as an "unlinked" badge that
  the user can fix.
- The editor at `/projects/[id]/materials/form` follows the IAQ form editor (`inspections/form`,
  `lib/checklists.ts:556-710`). Users can:
  - add, rename, reorder and switch off material types and rows;
  - set a row's credit link, required-document text, kind and target;
  - set the expiry years and the BOQ total.
- For dev verification, fill in the Oceanarium copy's targets from Rev03 through this editor.

### Screens
- **A new project tab, "Materials"**, after Credits (D38), in `ProjectTabs.tsx`, at
  `/projects/[id]/materials`. Available at any stage (D29).
  - At the top: the selected month (default this month). It lists the products reviewed that
    month with their status, plus C/D products still open from earlier (D3), plus the flags
    (D31):
    - resubmission overdue (C/D reviewed more than 14 days ago, no newer revision);
    - a certificate expiring within 30 days, or already expired.
  - Below: past months (count reviewed, A/B/C/D split, PDF link).
  - A Submittals list with "New submittal".
- **Submittal page:** its products, "Add product", and per product "New revision" (D9), which
  copies answers, types, ticks, quantities and document links into Rev n+1.
- **Product page:**
  - The header fields.
  - The material type picker. The "For all materials" block always shows, and the picked
    types' rows follow (D12).
  - Interior/exterior and the credit-part ticks, pre-ticked from the types (D33).
  - The four named document slots plus extras (D37).
  - Each row: Yes/No/N/A, value, unit, remark, documents with an issue date and an
    expired/valid badge, and the target shown beside it (D21).
  - BOQ quantities and the delivery log.
  - The review block: status, review date, remarks, sign-off names.
- **Credit page** (`app/(app)/projects/[id]/credits/[code]/page.tsx`), a new "Material Review"
  section:
  - For MW-05, HC-11, RC-01 and MW-04 (D24, D28):
    - per part: forecast %, actual % and pending share (D34), to date with the selected
      month's addition (D30);
    - RC-01 also shows coverage (D14);
    - the products behind each figure;
    - "Use this value", which fills the matching requirement entry (D15).
  - For other linked credits: the products and their answers for that credit, by month.
- **Reports page** (`reports/page.tsx`, `lib/reports.ts`): a "Material Review" card, one line
  per month with the PDF link.

### Calculation (`lib/materials/credits.ts`, pure functions, unit tested)
Each part is defined in code: the credit code, a key, the basis (weight, volume, cost or
count), the threshold(s), the manual's wording, and the requirement seq that
"Use this value" fills.
| Part | Basis | Threshold | Notes |
|---|---|---|---|
| MW-05 steel | weight | ≥50% | product ≥80% recycled |
| MW-05 aggregates | volume | ≥15% | |
| MW-05 timber | cost | ≥50% | |
| HC-11 VOC | weight | ≥95% | interior only |
| HC-11 formaldehyde | count | 100% | every product |
| RC-01 | cost | 20% / 40% | against the entered BOQ total |
| MW-04 | count | 100% | |

How each part is computed:
- **In scope:** the latest revision of every product ticked for the part, interior where the
  part requires it.
- **Compliant (D32):** Yes on every row linked to that credit, status A or B, and every
  document on those rows within the expiry window at the end of the month.
- **Forecast:** the BOQ quantities of A/B products. Under review or C are shown as pending.
- **Actual:** the sum of deliveries up to the month end.

### Outputs (D22)
- **SMQ PDF per product**, in the client's layout: header, rows, answers, sign-offs and
  consultant remarks.
  - Files: `lib/pdf/SmqSheet.tsx`, model `lib/report/smq-sheet.ts`, route
    `/api/projects/[id]/materials/products/[productId]/pdf`.
  - Reuses `lib/pdf/shared.tsx`.
- **Monthly material PDF:** the products reviewed, their statuses, credit progress and flags.
  Route `/api/projects/[id]/materials/months/[yyyy-mm]/pdf`.
- **Tracker .xlsx in the Appendix 8 column layout**, built with exceljs like
  `lib/export/scorecard.ts`. Route `/api/projects/[id]/materials/tracker`.

### Out of scope (by decision)
- The M&E compliance sheet (D16).
- AI document review (D23).
- Risk-register entries (D31: flags only).
- Contractor accounts and roles (D5).
- A default editor (D35).
- LEED scoring (D2).
- Percentages for SS-05, W-01 and E-01 (D28).

## Choices I made (flagged — say if any is wrong)
1. The project settings (expiry years, BOQ total) live on the project's SMQ copy, not the
   `project` table.
2. Calculated parts are defined in code. Only the default ticks per material type are in the
   seed.
3. Documents are shared across revisions through `material_answer_doc`. A file is deleted from
   disk only when no link remains.
4. "Use this value" matches requirements by credit code and requirement seq. Re-parsing keeps
   the ids, so this is stable.
5. The expiry warning starts 30 days before expiry. A resubmission is overdue 14 days after a
   C/D review date (the brief says "two weeks").
6. If a material type is removed from a product, its answers are kept but hidden, and come back
   if the type is re-added.
7. Editing the project's SMQ form never changes products already created (snapshot, like
   inspections).
8. Delivery follows the sprint workflow: branch `feat/material-review`, a task folder
   `docs/feedback/2026-10-sprint-3-material-review/` with this decision log copied in, one row
   per commit, tests and a real-browser check per row.

## Delivery rows (one commit each)
1. The task doc and decision log.
2. Schema and migration 0016, the evidence_doc refactor, the consumer audit, and the shared
   upload helper.
3. Seed 0017 with SMQ Rev03.
4. The project copy (`ensureProjectSmq`, code → id resolution) and the form editor.
5. The Materials tab, submittals, products, type picker, ticks and interior flag.
6. Product answers, row documents with issue date, and the named slots.
7. Review status, review date, remarks, and revisions.
8. BOQ quantities, the delivery log, and the calculation engine with unit tests.
9. The monthly view on the Materials page, past months and flags.
10. The credit page "Material Review" section and "Use this value".
11. The Reports page card.
12. The SMQ PDF per product.
13. The monthly material PDF.
14. The tracker .xlsx export.

## Verification
- **Unit tests** (`tests/materials-credits.test.ts`): each part's in-scope, compliant, forecast,
  actual and pending maths; expiry at the month end; latest revision only; interior filtering;
  the RC-01 coverage.
- **DB tests** (`describeDb`, `pnpm test:db`), following `tests/checklists.test.ts` and
  `tests/item-photo-actions.test.ts`:
  - the seed loads;
  - the copy resolves codes and flags unlinked ones;
  - the revision copy freezes Rev 00;
  - upload without an issue date is rejected;
  - evidence_doc requires exactly one owner;
  - existing credit evidence is unchanged.
- **Real data on the dev DB** (`netzero_v2`, `pnpm dev -p 3010` via run_in_background):
  - Enter JOTUN MTS-0411 (5 products, Paints & Coatings + Hard Flooring, one exterior).
  - Enter TBE-0001 rebar (3 manufacturers, deliveries in different months).
  - Check the MW-05 steel %, the HC-11 exclusion of the exterior product, the expired VOC report
    blocking compliance, the month views, the credit sections and all three exports.
- **Real-browser check per row** with scratchpad Playwright (the dev-DB recipe).
- `pnpm test`, `pnpm test:db`, `pnpm lint` and `pnpm build` all pass.

---

# Background (from the discussion)

## Context

Milestone 2 (client brief, Rev 03, 25 Oct 2026) puts five parts into a monthly sustainability
report. The Material Tracker comes first and is built on the SMQ (Sustainability Material
Questionnaire). For each material submittal the contractor uploads the submittal, the BOQ line,
the datasheets and a filled SMQ with its attachments. The consultant then checks it against
fixed requirements, project values and (for M&E) a design/supplier/tested compliance sheet,
and gives it a status: A, B, C or D. Approved materials count towards the material credits
automatically. Certificates older than 3 years count as expired.

## What the source files show

- **SMQ Rev03 (Oceanarium)** is one form per material. It has a header (submittal ref, location
  of use, material, rev, manufacturer, supplier, country of origin, contact) and a "For all
  materials" block with 7 rows: LEED MRc2 EPD and LCA, MRc3 recycled and regional, Mostadam
  RC-01 KSA manufacture, and MRc4 ingredients. Then come about 80 "Material type" rows (all
  metals, aggregate, wood, paints & coatings, adhesives & sealants, ceilings, insulation,
  sanitary fittings, lighting, envelope, glazing, AHUs …). Each row has a credit reference, the
  required documents and a Yes/No/NA/Value answer. It ends with a manufacturer statement, a
  contractor sustainability manager sign-off and the consultant's remarks: applicable or not,
  documents provided, comments, reviewer, date.
- **Credit references are often dual**, LEED / Mostadam ("MRc3 … / MW-05", "IEQc2 / HC-11").
  Some rows are LEED-only (MRc2, MRc4, IEQc9, LTc7) and some are Mostadam-only (RC-01, MW-07,
  HC-08, E-0x, W-04).
- **Fixed vs project-specific** is written into the answer column of the template:
  - "Fixed requirement": most rows.
  - "As per the project targeted requirement. When selected then it becomes fixed for the rest
    of the project": sanitary fixture flow rates.
  - "… part of the design package": LPD, U-values, SHGC, VLT (Oceanarium values are typed into
    the template).
  - "By the construction team": air tightness.
  - "Should be older than 3 years": the VOC rows. This reads as "not older than".
- **The filled JOTUN epoxy submittal (MTS-0411)** bundles 5 products, each with its own SMQ and
  its test reports. The consultant's remarks are partly negative ("LCA not provided", "proof of
  KSA manufacture not found", "VOC content is expired", "VOC not required — exterior use").
  **The contractor kept the "Ceilings" and acoustic rows for an epoxy floor primer**, when
  Paints & Coatings / Hard Flooring were the right rows. This is exactly the
  wrong-material-wrong-credit risk.
- **Appendix 8 Material Tracker** has one row per material per manufacturer: S/N, submittal ref,
  rev, approval status, description, submission date, applicable, discipline, supplier,
  delivery date, PO numbers, manufacturer. After those come column groups per credit with
  *values* (EPD operator, % post/pre-consumer, % FSC, material cost, allowed and actual VOC g/L,
  ODP/GWP, manufacturer location, distance in km, % regional by weight, total regional cost).
  A hidden sheet totals the regional percentage by month.
- **Risk register** is a separate Milestone 2 part, out of scope here except the auto-raised
  risks ("material rejected and not resubmitted in 2 weeks", "certificate about to expire").

## What the code has today

- `checklist_template → section → item`, `checklist_inspection → response`, photos as
  `evidence_doc`. Workspace defaults are seeded by SQL migration (IAQ 0009, ESC 0011) and copied
  per project on first use (`ensureProjectTemplate`, `lib/checklists.ts:192`). There is a
  per-project form editor at `/projects/[id]/credits/[code]/inspections/form`.
- Item answers are Yes/No/N/A plus a remark only. There are no value, number or attachment items.
- A template belongs to **one** credit. Responses never write to `requirement_entry`, and
  inspections never change credit status.
- **There are no periods or monthly checklists anywhere.** Inspections are one-off dated records.
  "Below the current period view" refers to something that does not exist yet.
- Single user, no roles. Contractor vs consultant would be new.
- The dev DB has all 56 credits including MW-04, MW-05, HC-11, RC-01. Both projects are at
  stage **design**.

## Research (online) — key findings

- **Mostadam material credits are percentages of a total, not per-material passes:**
  - MW-05: steel ≥50% *by weight* with ≥80% recycled content, aggregates ≥15% *by volume*,
    timber ≥50% *by cost* CoC-certified.
  - HC-11: ≥95% *by weight* of interior adhesives, sealants and paints within the VOC limits;
    every composite wood product and ceiling within the formaldehyde limits.
  - RC-01: ≥20% or ≥40% of material *cost* made in KSA (CSI divisions 03–10, 31, 32).
  - MW-04: every insulation product must pass.
  - So "approved materials count towards the credits automatically" needs a quantity (weight,
    volume or cost) per material, plus a project total for RC-01.
- **The 3-year certificate expiry is not in the Mostadam manual or LEED.** It is a
  client/project rule; EPDs normally last 5 years.
- **A/B/C/D meanings differ between Gulf projects.** "Approved as noted" counting toward credits
  is a convention, not a rule.
- **No official Mostadam SMQ template exists.** Consultants run their own.
- **Specialist tools keep the category → credit mapping central:** USGBC calculators, Green
  Badger, One Click LCA (Mostadam module), EC3, mindful MATERIALS. Only generic tools (Procore)
  let users define it. Category misassignment is a recurring LEED review failure.
- **Supports the user-built idea:** status legends, form layouts and targeted credits differ by
  project, and consultants already maintain their own SMQ.

## Decision log

(Filled in as you answer. Format: question → options offered → your answer → notes.)

### D1 — How the questionnaire is set up (2026-10-27)
- Options offered:
  - (a) **Seeded + editable.** SMQ Rev03 is the default, each project gets its own copy that can
    add material types, questions and credit links or switch rows off, the app suggests rows
    and the reviewer confirms.
  - (b) User-built from blank.
  - (c) Fixed, not editable (project values only).
- **Answer: (a) Seeded + editable.**

### D2 — LEED content in the SMQ (2026-10-27)
- Options offered:
  - (a) Drop LEED entirely.
  - (b) **Keep as reference text.** LEED rows and codes are shown so the form matches the
    client's paper SMQ, but only Mostadam links count.
  - (c) Keep LEED fully as a second rating system.
- **Answer: (b) Keep as reference text.**

### D3 — What "this month's checklist" means (2026-10-27)
- Options offered:
  - (a) **Month = submittals reviewed** that month. Open C/D items stay visible until
    resubmitted.
  - (b) Month = submittals received.
  - (c) A fixed monthly cycle that is opened and closed by hand.
- **Answer: (a) Month = submittals reviewed.**

### D4 — Quantities and credit percentages (2026-10-27)
- Options offered:
  - (a) **Capture and calculate.** Weight, volume or cost per material plus a project total
    material cost, with MW-05, HC-11 and RC-01 percentages computed automatically.
  - (b) Capture now, calculate later.
  - (c) Compliance only, no quantities.
- **Answer: (a) Capture and calculate.**

### D5 — Who fills and who reviews (2026-10-27)
- Options offered:
  - (a) **One user does both.** The consultant enters the contractor's SMQ and reviews it, with
    no roles and sign-off names as free text.
  - (b) Real contractor and consultant accounts with roles (reverses the solo decision).
  - (c) Contractor fills the SMQ through a share link without an account.
- **Answer: (a) One user does both.**

### D6 — Which statuses count toward credits (2026-10-27)
- Options offered:
  - (a) **A and B count**; C and D do not.
  - (b) Only A counts.
  - (c) A project setting, default A and B.
- **Answer: (a) A and B count.**

### D7 — Certificate expiry (2026-10-27)
- Options offered:
  - (a) **A project setting with a 3-year default.** Each certificate records its issue date and
    anything older is flagged and doesn't count.
  - (b) Fixed at 3 years.
  - (c) Separate windows per document type.
- **Answer: (a) Project setting, default 3 years.**

### D8 — Where the monthly material checklists show (2026-10-27)
- Options offered:
  - (a) On each credit page.
  - (b) A new project-level Materials page.
  - (c) Both of those.
  - (d) On the Reports page.
- **Answer: all of them.**
  - A new Materials page is where the review work happens.
  - Each targeted credit page gets a section with its slice: this month's values, the
    percentage and past months below.
  - The Reports page lists the monthly material checklists next to IAQ and ESC.

### D9 — Resubmission (2026-10-27)
- Options offered:
  - (a) **A new revision that keeps history.** Rev 01 is copied from Rev 00 and linked to it,
    Rev 00 stays frozen, and only the latest revision counts.
  - (b) Edit in place and bump the rev number.
- **Answer: (a) New revision, keep history.**

### D10 — What each SMQ row captures (2026-10-27)
- Options offered:
  - (a) **Answer, value and documents.** Yes/No/N/A, an optional value with unit, attached
    documents each with an issue date for the expiry check, and a remark.
  - (b) Yes/No/N/A plus a remark only.
  - (c) Option (a) plus an AI pre-fill from the datasheets.
- **Answer: (a) Answer + value + documents.**

### D11 — Submittal vs product (2026-10-27)
Hadi asked what "product" means. Explained: one specific item from one manufacturer with
its own datasheet and tests (the SMQ "Material Subject"). The JOTUN MTS-0411 holds 5 products,
each with its own SMQ and its own consultant remarks. The tracker gives TBE-0001 rebar 3 rows,
one per manufacturer.
- Options offered:
  - (a) **Submittal → products.** Each product has its own SMQ, documents, quantity and
    A/B/C/D status.
  - (b) Submittal → products with one shared status.
  - (c) Flat, one record per product.
- **Answer: (a) Submittal → products, status per product.**

### D12 — How the material-type rows are chosen (2026-10-27)
- Options offered:
  - (a) **Pick types, rows follow.** The reviewer picks one or more material types per product,
    and the "For all materials" block plus those types' rows appear. No AI.
  - (b) AI suggests the types.
  - (c) Show all rows and mark N/A.
- **Answer: (a) Pick types, rows follow.**

### D13 — Which quantity drives the percentages (2026-10-27)
- Options offered:
  - (a) The delivered (PO) quantity, as a delivery log per product.
  - (b) The BOQ quantity only.
  - (c) **Both.**
- **Answer: (c) Both.** The BOQ quantity is the forecast and the deliveries are the actual. The
  credit page shows a forecast % and an actual %.

### D14 — The RC-01 denominator (2026-10-27)
- Options offered:
  - (a) A total construction material cost entered from the BOQ.
  - (b) The sum of the products in the app.
  - (c) **Show both.**
- **Answer: (c) Show both.** The percentage uses the entered BOQ total, and a coverage figure
  shows how much of that total the products in the app account for.

### D15 — Effect on the credit's own requirement checklist (2026-10-27)
- Options offered:
  - (a) Show only, no writing.
  - (b) **Suggest, user applies.** A "Use this value" button fills the requirement value.
  - (c) Write automatically, no override.
- **Answer: (b) Suggest, user applies.**

### D16 — M&E Sustainability Compliance Sheet (2026-10-27)
- Options offered:
  - (a) **Later, as a separate phase.**
  - (b) Include it now.
  - (c) Out of scope.
- **Answer: (a) Later, separate phase.**

### D17 — Where the SMQ lives in the database (architecture, 2026-10-27)
- Options offered:
  - (a) **New SMQ tables:** template → material types → rows with credit links, plus
    submittal → product → answers and deliveries. Same patterns as the checklists.
  - (b) Extend the checklist_template, item and response tables.
- **Answer: (a) New SMQ tables.**

### D18 — Files (refactor, 2026-10-27)
- Options offered:
  - (a) **One file table with the credit optional.** `evidence_doc.project_credit_id` becomes
    nullable and a product link is added. One upload path and one download route.
  - (b) A separate material_document table with its own route.
  - (c) A copy of the file under each linked credit.
- **Answer: (a) One file table, credit optional.** Every place that assumes a file has a
  credit has to be audited.

### D19 — Seeding the default SMQ Rev03 (2026-10-27)
- Options offered:
  - (a) **A SQL seed migration** with fixed ids, like IAQ 0009 and ESC 0011.
  - (b) An Excel import screen in the app.
  - (c) Both (seed now, import later).
- **Answer: (a) SQL seed migration.**

### D20 — How rows point at credits (2026-10-27)
- First round:
  - Options offered: (a) by credit code, resolved against the project's catalog; (b) by catalog
    credit id.
  - Answer: (b) by catalog credit id.
- **Conflict raised with D19.** Catalog credit ids are random UUIDs created when a parsed PDF is
  promoted, after the migrations run, so a seed migration can't contain them. Re-promotion keeps
  the ids.
- Second round, options offered:
  - (a) **Default by code, copy by id.**
  - (b) By code everywhere.
  - (c) Seed after parsing, with ids everywhere.
- **Answer: (a) Default by code, copy by id.** The seeded default holds codes. When a project
  gets its copy, each code is resolved once to that project's catalog credit id and stored as an
  id. Codes the catalog lacks are shown as unlinked for the user to fix.

### D21 — Pass/fail on project-value rows (2026-10-27)
- Options offered:
  - (a) The app compares the value against a stored comparator and target, and the reviewer can
    override.
  - (b) **The reviewer judges, with the target shown.**
- **Answer: (b) Reviewer judges, target shown.** No automatic comparison.

### D22 — Outputs in this work (2026-10-27, multi-select)
- Options offered:
  - SMQ PDF per product (client layout).
  - Tracker Excel export (Appendix 8 layout).
  - Monthly material PDF.
- **Answer: all three.**

### D23 — AI review of SMQ documents (2026-10-27)
- Options offered:
  - (a) **Later.**
  - (b) Yes, now.
  - (c) No.
- **Answer: (a) Later.**

### D24 — Credits calculated in this work (2026-10-27, multi-select)
- Options offered:
  - MW-05, all 3 parts.
  - HC-11 VOC share by weight, with formaldehyde as an every-product pass/fail.
  - RC-01 KSA cost share.
  - MW-04 all-insulation pass count.
- **Answer: "All", plus all four ticked.** Clarification asked in D28.

### D25 — Units (2026-10-27)
- Options offered:
  - (a) **Fixed units:** tonnes, m³ and SAR.
  - (b) A unit per product, with conversion.
- **Answer: (a) Fixed units: t, m³, SAR.**

### D26 — Which date puts a review into a month (2026-10-27)
- Options offered:
  - (a) **An entered review date**, defaulting to today.
  - (b) The save time.
- **Answer: (a) Entered review date.**

### D27 — A document's issue date (2026-10-27)
- Options offered:
  - (a) **Required on upload.**
  - (b) Optional, flagged and not counted.
  - (c) Optional and counted.
- **Answer: (a) Required on upload.**

### D28 — What "All" meant in D24 (2026-10-27)
- Options offered:
  - (a) **Just the four.**
  - (b) Every linked credit, including SS-05 by area and the tool-based W-01 and E-01.
- **Answer: (a) Just the four:** MW-05, HC-11, RC-01 and MW-04. Other SMQ-linked credits show
  their products and answers on the credit page, without a percentage.

### D29 — Stage gating (2026-10-27)
- Options offered:
  - (a) **Any stage.**
  - (b) Construction only.
- **Answer: (a) Any stage.**

### D30 — What the percentage covers (2026-10-27)
- Options offered:
  - (a) **To date plus this month:** cumulative to the end of the selected month, with that
    month's addition beside it.
  - (b) That month only.
- **Answer: (a) To date + this month.**

### D31 — Automatic risks (2026-10-27)
- Options offered:
  - (a) **Flags now, risks later.** Warnings for resubmissions overdue after 2 weeks and expiring
    certificates now, becoming risk-register entries when the register is built.
  - (b) Out of scope.
  - (c) Build a minimal risk register too.
- **Answer: (a) Flags now, risks later.**

### D32 — What makes a product compliant for a calculated credit part (2026-10-27)
- Options offered:
  - (a) **Yes, A/B and in date:** the reviewer answered Yes on that credit's rows, the status is
    A or B, and every document on those rows is inside the expiry window.
  - (b) Yes and A/B, with expired documents only flagged.
- **Answer: (a).**

### D33 — Which products are in a calculated credit's total (2026-10-27)
- Options offered:
  - (a) **Material type plus a reviewer tick.** The type pre-ticks the credit parts, the reviewer
    unticks what doesn't apply and marks interior or exterior.
  - (b) Material type only.
- **Answer: (a).**

### D34 — What the forecast includes (2026-10-27)
- Options offered:
  - (a) **A/B products by BOQ quantity, with pending shown.** C and under-review products appear
    as a separate pending share.
  - (b) Every submitted product.
- **Answer: (a).**

### D35 — Editing the workspace default (2026-10-27)
- Options offered:
  - (a) **Project copies only.** The default changes through a new seed migration, as with IAQ
    and ESC.
  - (b) A default editor too.
- **Answer: (a) Project copies only.**

### D36 — Oceanarium values in the default (2026-10-27)
- Options offered:
  - (a) **Blank targets and a neutral title in the default**, with the Oceanarium copy filled in
    to match the client's form.
  - (b) Keep the Oceanarium values in the default.
  - (c) Blank everywhere.
- **Answer: (a).**

### D37 — Product-level uploads (2026-10-27)
- Options offered:
  - (a) **Named slots** (Submittal, BOQ line, Datasheet, Filled SMQ), plus extras, with the
    missing ones shown.
  - (b) Free attachments only.
- **Answer: (a) Named slots.**

### D38 — Where the Materials page sits (2026-10-27)
- Options offered:
  - (a) **A tab after Credits.**
  - (b) A tab before Reports.
  - (c) A tab after Credits plus a sidebar entry.
- **Answer: (a) Tab after Credits.**

---

## Done — 2026-10-27

Built on `feat/material-review`: 15 commits, one per row of the plan. Rows 5–7 share a commit
because they share one library. Not pushed; no PR.

### How it works for the user

1. **Materials tab** (after Credits). It opens on **this month's material checklist**:
   - counts by status;
   - warnings: a resubmission overdue 14 days after a C/D, and certificates expiring within
     30 days or expired;
   - the products reviewed this month, and C/D products still open from earlier months;
   - the material credit parts to date, with the change since last month.
   Below that: **Monthly checklists** (every past month, each opening the same view as at its
   end, with a PDF), then the **Submittals**.
2. **Questionnaire** (button on Materials). The project's own copy of SMQ Rev03, made on first
   visit. Material types and rows can be edited, each row has its credit, kind and project
   target, and there are two settings: certificate expiry years and the BOQ material cost for
   RC-01. The Oceanarium copy has its Rev03 targets filled in (fixture flow rates, U-values,
   SHGC, VLT).
3. **New submittal → Add product.** Each product is one SMQ:
   - the header;
   - its material types (their rows join "For all materials");
   - the credit parts it counts toward, pre-ticked from its types, and interior or exterior;
   - named document slots;
   - per-row answers, values and certificates, where an issue date is required;
   - BOQ quantities and a delivery log;
   - the review (A–D, review date, remarks, sign-offs);
   - "Where it stands this month";
   - Download SMQ (PDF).
   **New revision** starts Rev n+1 from a reviewed product; Rev n stays read-only.
4. **Credit pages** get a *Material Review* section:
   - every product's answers for that credit, by review month;
   - for MW-05, HC-11, RC-01 and MW-04: forecast, actual and pending shares, the products
     behind them with the reason each does or doesn't count, month-by-month history, and
     *Use forecast* / *Use actual*, which fill the requirement value.
5. **Reports** lists the monthly material checklists (PDF each) and the **material tracker
   (.xlsx)**.

### How it was checked

- **Tests:**
  - `pnpm test`: 211 passed, 45 skipped. `pnpm test:db`: 256 passed.
  - New suites: `tests/materials-credits.test.ts` (the maths and expiry),
    `tests/materials-db.test.ts` (schema, seed, project copy, products, documents,
    revisions, snapshot, month view, credit slice, Use this value) and
    `tests/material-tracker.test.ts`.
- **Build and lint:** `pnpm build` passes. `pnpm lint` has 0 errors; its 5 warnings were
  already there, in files this work didn't touch.
- **Real browser:** Playwright with JS on, against `netzero_v2`, on the Oceanarium. Every page
  was clicked through:
  - MTS-0411 Jotafloor Easyflow Primer HS: Paints & Coatings plus Carpet/Hard Flooring, not
    the Ceilings rows the contractor used. A C review with the consultant's remarks; the 2022
    VOC report shows as expired; an upload without an issue date is refused.
  - TBE-0001 rebar from ITTIFAQ (A, 600 t), WESTERN STEEL (B, 300 t) and THILAL (C, 100 t),
    with deliveries in June and July.
  - MW-05 steel reads 60% for May, 90% for June and 90% for July (no change). Use forecast
    wrote 90 into MW-05 requirement 1.
  - THILAL was resubmitted as Rev 01; Rev 00 is read-only.
  - Screenshots are in `evidence/`.
- **Downloads:** the PDFs and the workbook were fetched from the running server and read back.
  They are in `evidence/` as 12-…pdf, 13-…pdf and 14-material-tracker.xlsx.

### Calls made while building (please check)

1. On a row a certificate needs its issue date. In a product slot (submittal, BOQ line,
   datasheet, filled SMQ) the date is optional.
2. On the counting rule (D32):
   - N/A rows are neutral, but at least one row for the credit must be Yes.
   - A Yes row with no document still counts; only documents that are present are checked
     for expiry.
3. Rejected (D) products leave the total: the material won't be used. C and unreviewed
   products are pending.
4. A month uses each product's revision that was current at the month's end. A first revision
   exists from its submittal date, so back-filled records land in the right months.
5. RC-01's actual share also divides by the BOQ material cost. MW-04 and HC-11 formaldehyde
   count products and have no actual.
6. The tracker keeps Appendix 8's twelve identifying columns. Its LEED and Estidama credit
   columns are replaced by Mostadam ones, and two sheets are added: Answers and Credits.
7. Seeded wording:
   - The SMQ's notes are verbatim, including "should be older than 3 years" on the VOC rows,
     which means not older.
   - Rev03's thermal-conductivity row has no note; it is seeded as a fixed requirement.
   - The default title is "LEED & Mostadam Material Review Questionnaire".
8. A new revision can be started from any reviewed status, not only C/D.
9. Material files are not listed on the project Documents page.

### Not in this work (by decision)

- M&E compliance sheet (D16).
- AI review of material documents (D23).
- Risk-register entries; the flags only warn (D31).
- Contractor accounts (D5).
- A default-questionnaire editor (D35).
