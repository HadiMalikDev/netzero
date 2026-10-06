# 1 — IAQ / ESC compliance checklist, generated as a PDF

**Type:** Feature · **Verdict:** All inputs already exist; nothing new to enter · **Effort:** M

## As raised

> Search online for ESC and IAQ checklists. Let me know if we can make those.
>
> This is something that should get generated automatically from the existing
> status of the project. It's not something that the user would manually
> create. For the images, item answers and all that, we can just generate the
> report and then download it.

Green Badger (the LEED tool the client knows) has in-field IAQ and ESC
inspection checklists. The ask is the Mostadam equivalent, produced from what
the project already holds, downloaded as a document.

## What the manual asks for

Both checklists map to a Mostadam credit. Page numbers are the Commercial D+C
manual's own.

**IAQ → HC-10 Indoor Air Quality, requirement 1** (pp. 180–182). The
construction-stage evidence names the checklist outright:

> Completed IAQ Checklist of all regular inspections performed onsite during
> construction stage with supporting date-stamped photographic evidence.

The supporting guidance fixes the plan's six control-measure categories
(SMACNA plus Mostadam's own Moisture & Mold Control): HVAC Protection, Source
Control, Moisture & Mold Control, Pathway Interruption, Housekeeping,
Scheduling. It adds a flush-out (2 ACH after testing and balancing) and, for
requirement 2, the IAQ test limits of Table HC-10.1.

**ESC → SS-03 Construction Environmental Management, requirement 1**
(pp. 39–42). Mostadam has no erosion-and-sedimentation credit; the word
"erosion" appears once in the whole manual, as a soil bullet in SS-04. The
construction-stage evidence SS-03 wants is:

> Site audit report provided by the contractor which includes photographic
> evidence verifying compliance with the CEMP.

and the guidance lists the CEMP's seven sections (a–g): EIA, dust control,
noise monitoring, waste management, energy and water reduction, site audit
plan, materials transport and procurement. That is where ESC lives in
Mostadam. Building a LEED-style ESC form would go against the Mostadam-only
scope.

## What exists today

Everything the report needs is already stored and already shown on the credit
screen. Checked against the running parser on 2026-10-07:

| Input | Where it lives | HC-10 | SS-03 |
|---|---|---|---|
| Requirement text, status, value, note | `requirement_entry` + `catalog_requirement` | 2 rows | 2 rows |
| Required documents, tagged by stage | `catalog_requirement.evidence_specs` | 4 + 3 | 4 |
| Which documents are due at the project's stage | `docGates()` in `lib/evidence.ts` | derived | derived |
| Files per document (name, size, date, path on disk) | `evidence_doc.evidence_spec_index` | — | — |
| AI read of each file: verdict, summary, quotes, gaps | `evidence_review` | — | — |
| Credit-level additional attachments | `evidence_doc` with null requirement | — | — |
| The manual's plan contents (control measures, CEMP sections) | `catalog_credit.supporting_guidance` | 6 items | 7 sections |
| Project name, stage, target level, rating system | `project`, `rs_version` | — | — |

The supporting guidance is stored as one flattened string (the parser joins
the lines), but its list markers survive: `o HVAC Protection o Source Control
…` on HC-10 and `a) … • … o …` on SS-03. All 56 credits carry guidance.

There is also a working PDF path: `lib/pdf/CatalogReport.tsx` renders with
`@react-pdf/renderer` (built-in Helvetica, a `safe()` WinAnsi filter, a
hyphenation hook) through `app/api/catalog/[versionId]/pdf/route.ts`, and the
Excel scorecard shows the per-project download pattern
(`app/api/projects/[id]/export/route.ts`, `ExportScorecardLink`).

## Proposed change

One **Download compliance checklist (PDF)** button on every credit page. The
PDF is built from the credit's current state at the moment of download. No new
table, no migration, nothing for the user to fill in.

It is built for any credit, not just HC-10 and SS-03. The data model is
identical across all 56 credits, and a parser that only knows two credits is
the overfitting mistake already logged in `MISTAKES.md`. HC-10 is the IAQ
checklist and SS-03 is the ESC/CEMP checklist because of what their documents
and guidance say, not because the code names them.

### What the PDF contains

1. **Header.** Project, rating system and version, project stage, target
   level, credit code and title, credit status and points, manual page span,
   generation date and time. Marked clearly as generated from project records.
2. **Requirements.** One block per requirement in scope (set-aside either/or
   options named apart, as the Required documents box does): text, status,
   recorded value, note.
3. **Required documents checklist.** One row per listed document, with:
   - stage tag and whether it is due at the project's stage;
   - state: **Provided**, **Provided with gaps**, **Missing**, or **Not due
     yet**. Provided means a file is attached against that document. "With
     gaps" means the AI read returned `partially_met` or `not_met`;
   - the files: name, size, upload date;
   - the AI read, labelled advisory: verdict, one-line summary, listed gaps.
4. **Photographs.** Any attached file that is a PNG or JPEG is embedded, with
   its filename, upload date and the document it was attached to. That is the
   "date-stamped photographic evidence" HC-10 and SS-03 both ask for, drawn
   from uploads the contractor already made. Other formats (PDF, DOCX…) are
   listed, not embedded. A per-image size cap applies; a file over it is
   listed with a note.
5. **What the manual requires the plan to contain.** The itemised list pulled
   from the stored supporting guidance: the six control measures on HC-10, the
   seven CEMP sections on SS-03. Printed as a reference checklist for whoever
   reviews the uploaded plan. These rows are **not** ticked by the app: nothing
   in the data says whether the uploaded IAQ plan covers Housekeeping. If the
   guidance has no recognisable list, the section is omitted.
6. **Additional attachments** at credit level, listed.

### What it must never do

- Mark a document Provided without a file behind it.
- Let the AI verdict change a state on its own. It is printed next to the
  state, never used to compute it. This matches the rule already in
  `lib/ai/evidence-review.ts`.
- Claim to be a log of dated site inspections. The manual's own wording is
  "IAQ Checklist"; the PDF is titled **Compliance checklist** and its header
  says it was generated from project records on a given date. If an assessor
  wants the contractor's weekly sheets, those are what the contractor uploads
  against the "Completed IAQ Checklist" document, and this PDF then carries
  them.

### Commits, in order

Each is one commit on `feat/compliance-checklist-pdf`, with its tests, and
is checked in a browser before the next starts.

| # | Commit | Files | Tests |
|---|---|---|---|
| 1 | **Guidance items.** Split a stored supporting-guidance string into headed item lists, tolerant of the flattened form and of page-number noise (`182`, `41` mid-text). Returns `[]` when no list is found. | `lib/report/guidance-items.ts` | HC-10 → 6 control measures; SS-03 → 7 sections a–g with their bullets; a guidance string with no list → `[]`; a string with a stray page number does not produce a row |
| 2 | **Checklist model.** Pure function `CreditView + project + stage → ChecklistModel`: document rows with state, files, review; photos; guidance items; set-aside options. No I/O. | `lib/report/checklist.ts` | state per document for every combination of file / review verdict / due; set-aside options excluded; optional rows not counted; credit-level files listed separately; PNG/JPEG picked as photos, others not |
| 3 | **Shared PDF primitives.** Move `safe()`, the palette, base styles and `registerPdfHyphenation` out of `CatalogReport.tsx` into `lib/pdf/shared.ts`. Behaviour-preserving; the catalog PDF route is re-downloaded and compared. | `lib/pdf/shared.ts`, `lib/pdf/CatalogReport.tsx` | existing `catalog-export` tests stay green |
| 4 | **Checklist PDF.** `ChecklistReport.tsx` renders the model. Images read from `evidence_doc.file_path` by the route, passed in as buffers so the component stays pure and testable. | `lib/pdf/ChecklistReport.tsx` | renders to a buffer for a fixture model with every state present; a model with an unreadable image path still renders |
| 5 | **Route and button.** `GET /api/projects/[id]/credits/[code]/checklist`: auth, workspace-scoped (`getProject` → 404 for another workspace), Node runtime, `force-dynamic`, `Content-Disposition: attachment`, filename `<project>-<code>-checklist.pdf`. Button in the credit header next to Export/Targeted. | `app/api/projects/[id]/credits/[code]/checklist/route.ts`, credit `page.tsx` | route returns 401 unauthenticated, 404 for a foreign project, 200 `application/pdf` otherwise |
| 6 | **Done section + screenshots** appended here. | this file, `evidence/` | — |

Stretch, only if asked: a project-level **Compliance pack** on the Documents
page that concatenates every targeted credit's checklist. Same component, one
more route.

### Browser check before calling it done

On the Jeddah project, in Playwright:

1. HC-10 at design stage, nothing uploaded: download, open the PDF, every
   construction document reads Not due yet, the design document reads Missing,
   the six control measures are listed.
2. Upload a JPEG site photo against "Completed IAQ Checklist…" and a PDF
   against "IAQ Management Plan…", let the AI read finish, download again:
   the photo is embedded with its date, the plan is listed with the verdict.
3. Switch the project to Construction: the same documents now read Missing or
   Provided, never Not due yet.
4. SS-03: the seven CEMP sections appear; the site-audit document row carries
   its photo.
5. A credit with no list in its guidance renders without the guidance section
   and without error.
6. E-01 (either/or): the set-aside option is named, not listed.
7. The existing catalog PDF still downloads and looks the same after commit 3.
8. No console errors, no 5xx; `pnpm test`, `tsc --noEmit`, `pnpm lint`.

## Decisions for you

1. **Name.** "Compliance checklist" on the button and the PDF, not
   "inspection report". Say if you want the manual's phrase "IAQ Checklist"
   used on HC-10 specifically.
2. **Per-credit first.** The IAQ and ESC asks are two credits. A whole-project
   pack is a small follow-up once the per-credit PDF is approved.
3. **Guidance rows stay unticked.** Ticking "Housekeeping covered" would need an
   AI pass over the uploaded plan against the list. It can be added later as
   an advisory column, same rules as the existing AI read. Not in this item.
4. **Images.** Only PNG and JPEG embed; `@react-pdf/renderer` does not take
   WebP, GIF or PDF pages. Those are listed by name.

## Out of scope

- Any manual data entry: templates, inspections, item answers, signatures.
- A LEED-style ESC form. Erosion control enters through SS-03's CEMP.
- Changing how status or points are computed.
- Re-parsing the catalog. Guidance is read from the stored string at download
  time, so existing versions work without a migration.
