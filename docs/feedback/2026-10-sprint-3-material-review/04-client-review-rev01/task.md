# 04 — Client review Rev 01 of the Materials pages

Raised: 2026-11-02 · Source: the client's "Platform Review Comments – Rev 01" (`start-data/Materials Review_Rev01.pdf`, not committed)

## The comments

| # | Area | Client's correction | App today | Change |
|---|------|---------------------|-----------|--------|
| 1.1 | Material credits to date | List every targeted material credit; show where Forecast (BOQ) and Actual (Delivered) come from. | Always the same 7 calculated lines (MW-05 ×3, HC-11 ×2, RC-01, MW-04), targeted or not; other SMQ-linked credits never appear. | Build from targeted credits (D45); source notes on both columns. |
| 1.2 | Page header | An "Upload material submittal" button asking only for data sheets, the BOQ extract, and the SMQ pages with attachments. | "+ New submittal" asks for typed fields; products and answers are entered by hand. | Upload queue (D44, D46). |
| 1.3 | Reviewed this month | On upload, identify the material, pick its requirements, split critical from waivable, give met / not met / missing per requirement and an overall A/B/C/D. | Reviewer judges every row and sets the status (D5, D21); AI review deferred (D23); no "critical" notion. | **On hold** (D47). |
| 1.4 | Tracker (.xlsx) | The tracker is empty. | It lists every product; empty because nothing could be uploaded. | Fills once 1.2 creates products. |
| 1.5 | Questionnaire | General vs material-specific requirements; an inactive requirement must not be used; upload from this page too. | The split exists ("For all materials" + types). Active only affects products added later. | Rename (D49); inactive stops counting everywhere (D48); same upload button. |

## Decisions

### D44 — One upload per product, submitted together (2026-11-02)
- Options offered:
  - (a) The AI splits a multi-product upload into products; the reviewer checks.
  - (b) One upload per product.
- **Answer: (b), with a queue:** the user adds one product's files at a time, then submits
  them all together.

### D45 — Targeted material credits without a calculation (2026-11-02)
- Options offered:
  - (a) **One line per credit: products and how many comply** ("4 products, 3 comply";
    comply = status A/B and Yes on that credit's rows). No percentage.
  - (b) Listed with a link only.
- **Answer: (a), as long as it is deterministic** — a fixed rule over the saved answers, no AI.

### D46 — What an upload does while the assessment is on hold (2026-11-02)
- Options offered:
  - (a) **Store the files in the product's slots; the AI fills the header** (name,
    manufacturer, supplier, country, material types) for the reviewer to check; the reviewer
    answers the questionnaire as today.
  - (b) Store files only.
  - (c) Build nothing until the assessment decisions are made.
- **Answer: (a).**

### D47 — The assessment (1.3) (2026-11-02)
Three questions put, all answered **"Leave for now"**:
- Who sets the final status: (a) AI proposes, reviewer confirms; (b) AI status is final;
  (c) AI fills verdicts, reviewer sets status.
- What is critical: (a) default by kind, editable per row; (b) marked by hand only; (c) every
  active row is critical.
- The A/B/C/D rule: (a) A all met, B all critical met, C a critical one not met or missing,
  D wrong material, client to confirm; (b) ask the client first.

### D48 — An inactive requirement on products that already have it (2026-11-02)
- Options offered:
  - (a) **It stops counting everywhere**: the answer stays on record, shown greyed as an
    inactive requirement, and counts toward no credit or assessment; active again brings it
    back.
  - (b) Only new products, as now.
- **Answer: (a).**

### D49 — Naming the two parts (2026-11-02)
- Options offered:
  - (a) **"General requirements" / "Material-specific requirements"** in the editor, the
    product page, the SMQ PDF and the tracker.
  - (b) Editor only.
- **Answer: (a).**

## Plan (one commit per row, not started)

1. D49: rename the two parts everywhere.
2. D48: inactive rows stop counting toward credits for every product; greyed on the product page.
3. 1.1 / D45: "Material credits to date" from targeted credits; non-calculated credits as
   "N products, M comply"; source notes on Forecast and Actual.
4. D44 / D46: "Upload material submittal" on the Materials and Questionnaire pages — a queue of
   products, each with its data sheets, BOQ extract and SMQ pages, submitted together into a new
   submittal; files land in the named slots.
5. D46: the AI fills each product's header and material types from its files (the existing
   OpenRouter client and PDF text extraction), shown for the reviewer to check.

On hold: 1.3 (D47). 1.4 needs no change of its own.

## Choices I made (flagged — say if any is wrong)

1. Step 3: "material credit" = a targeted credit that has a calculated part or that an active
   questionnaire row links to. Untargeted credits drop out of the table and the monthly PDF.
   The other credits sit under one heading row with "M of N comply"; D products are left out,
   as in the calculated parts.
2. Step 4: the upload is a page of its own (`/materials/upload`); "+ New submittal" (typed)
   stays for entering one by hand. Data sheets go in the Technical data sheet slot, the BOQ
   extract in BOQ line, the SMQ pages and their attachments all in Filled SMQ. A product is
   named from its first file until the AI or the reviewer names it. Files picked but not yet
   added to the list are submitted too. Over 50 MB in one submit (the server's limit) is
   refused before sending.
3. Step 5: the AI reads only PDFs with text (no scans, images or spreadsheets), up to 16,000
   characters per product, fills only empty fields, and is shown as a note on the submittal
   page after the upload, not stored on the product.

## Done

- `04e9076` D49: "General requirements" / "Material-specific requirements" — migration 0018
  renames the block and the wording copied into answers; editor, product page and SMQ PDF
  (`evidence/r1-editor.png`).
- `b2b1f79` D48: an answer whose row is inactive counts toward no credit, for every product;
  greyed as "Inactive requirement" (`evidence/r2-inactive.png`). DB test: off → out of the
  snapshot, on → back.
- `c47568e` 1.1 / D45: the credits table lists targeted material credits, with source notes
  and tooltips (`evidence/r3-credits.png`). Unit tests of the count rule.
- `93b25c2` D44: "Upload material submittal" on the Materials and Questionnaire pages; a queue
  of products submitted together (`evidence/r4-queue.png`, `evidence/r4-submittal.png`). DB
  tests: one product per upload, files in their slots; an empty product creates nothing.
- `020b00a` D46: the AI fills each uploaded product's information. DB test with the model
  stubbed: the file's text and the type list reach the model; read values are saved, types
  must be on the list, typed values are never overwritten. **Not run live:** the dev
  `OPENROUTER_API_KEY` is rejected by OpenRouter (401 "User not found"); the browser check
  shows the fallback note (`evidence/r5-ai-unavailable.png`).
- `pnpm test` 216 passed; `pnpm test:db` 272 passed; lint 0 errors; build passes.
