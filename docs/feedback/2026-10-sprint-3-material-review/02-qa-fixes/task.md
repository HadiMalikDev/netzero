# 02 — QA fixes for the Material Review

Raised: 2026-10-27 (end-to-end QA of item 01) · Branch: `feat/material-review`

## The request

> all, except product findings. do the rest, one commit at a time. then ask me questions for the
> product findings

## What the QA found

Every Material Review flow was driven in a real browser (Playwright) on a throwaway project,
"QA Material Review". The maths, revisions, PDFs and tracker were right. These findings were not:

| # | Finding | Kind | This item |
|---|---------|------|-----------|
| 1 | Invalid input crashes the page ("This page couldn't load", typed input lost): BOQ "abc", blank title, spaces-only row text / submittal ref / product name, status without a review date, BOQ quantity "abc" or −5, delivery without a quantity. (The QA report also said the submittal ref/title and product name lack `required`; they have it — the check misread the attribute. Only spaces get past it.) | Bug | Fix |
| 2 | Dates not checked: review date in the future or before the submission date; certificate issue date in the future (shown as valid); delivery in the future. | Bug | Fix |
| 3 | Removing a material file or a delivery has no confirmation, though the file is deleted from disk. Credit evidence asks first. | Bug | Fix |
| 4 | Add forms keep their values after a successful add (delivery, add row, add material type), so a second click adds a duplicate. | Bug | Fix |
| 5 | A new revision copies Rev 00's manufacturer and contractor sign-offs (names and dates). | Product | Ask |
| 6 | The tracker lists each revision's deliveries, so summing the delivered column counts a resubmitted product twice. | Product | Ask |
| 7 | "Use forecast" on RC-01 below 20% silently unticks "Mark this requirement as done", including a manual tick; no message after applying. | Product | Ask |
| 8 | Monthly PDF: "0 of 0 count" where the page says "none yet"; mixed "—" and "-"; the reviewed table can start with one row at the foot of a page. | Polish | Fix |
| 9 | Validation errors also say "this revision has been replaced" when the cause is a missing name or date. | Bug | Fix |

## Plan (one commit per row)

1. This task doc.
2. Finding 9: check that the revision is the latest before validating, so each error names its
   own cause.
3. Finding 1: a refused save returns an error code, and the form shows the message beside itself
   without leaving the page, so what was typed stays. `required` on the questionnaire title and
   material type names.
4. Finding 2: date checks on the server, with `min`/`max` on the date inputs.
5. Finding 3: confirmation before removing a material file or a delivery.
6. Finding 4: add forms start empty again after a successful add.
7. Finding 8: monthly PDF polish.
8. Done section, evidence, full test run.

Then the questions for findings 5–7, with every option and the answers recorded below.

## Choices I made (flagged — say if any is wrong)

- **Review date:** not after today, and not before the submittal's submission date when one is
  entered.
- **Certificate / document issue date:** not after today.
- **Delivery date:** not after today. No lower bound: material can arrive on site before its
  submittal is approved.
- **Sign-off dates** (manufacturer, contractor): not after today.
- **Date of submission:** not after today (added while building; same rule as the others).
- "Today" is the Saudi date (UTC+3), as everywhere else in the Material Review.
- **Errors in place, not by redirect:** a first try sent the page back with `?error=`; that
  remounts the page and drops what was typed, so the forms run their save in place instead.

## Done (2026-10-27)

Each fix was checked in a real browser (Playwright, JS on) on the QA project, and has tests where
it has logic. Full run after the last fix: `pnpm test` 211 passed / 49 skipped, `pnpm test:db`
260 passed, `pnpm lint` 0 errors (the 5 warnings are in files this item doesn't touch),
`pnpm build` passes.

| Finding | Commit | What changed | How it was checked |
|---|---|---|---|
| 9 | `3c3410e` | The product actions check the revision first (`productState`), so a missing name or date no longer says "this revision has been replaced". | DB test; dev error text read in the browser. |
| 1 | `d6769d3` | The validated actions return an error code (`lib/materials/form-errors.ts`) instead of throwing, and `ActionForm` (`components/ActionForm.tsx`) shows the message beside the form without leaving the page, so what was typed stays. `required` on the questionnaire title and material-type names. | `tests/material-form-errors.test.ts`; in the browser, all twelve forms with bad input: message in place, input kept, no error page; a valid save clears the message. |
| 2 | `ed3e115` | Review date not after today and not before the submittal's date of submission; sign-offs, deliveries, certificate issue dates and dates of submission not after today. The date inputs carry the same `min`/`max`. | DB tests for each rule; in the browser, the date inputs block the date, and with `max` removed the server message shows in place. No existing record breaks a rule. |
| 3 | `6b7a3cf` | Removing a product file or a delivery asks first (`components/ConfirmSubmit.tsx`). | Browser: Cancel keeps the file / delivery, OK removes it. |
| 4 | `d7bf298` | The delivery, add-row and add-material-type forms are keyed by their item count, so an add leaves an empty form; a refused add keeps the input. | Browser: after each add the form is empty and the new item is listed. |
| 8 | `c1aa453` | Monthly PDF: "none yet" for parts with no products, one dash for empty cells, headings kept with at least the start of their table. | PDF regenerated for October 2026: [page 1](evidence/finding8-month-pdf-page1.png), [PDF](evidence/finding8-material-checklist-2026-10.pdf). |

Evidence: [review error in place](evidence/finding1-review-error-in-place.png),
[future sign-off refused](evidence/finding2-signoff-date-refused.png).

Found while checking: after an add, the questionnaire editor takes a few seconds to show the new
row or type (the page has 48 sections). The QA report's "added type not shown" was this delay,
not a lost save.
