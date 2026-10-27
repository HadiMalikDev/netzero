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
| 1 | Invalid input crashes the page ("This page couldn't load", typed input lost): BOQ "abc", blank title, blank or spaces-only row text / submittal ref / product name, status without a review date, BOQ quantity "abc" or −5, delivery without a quantity. Submittal ref/title and product name have no `required`. | Bug | Fix |
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
3. Finding 1: validation failures come back to the same page with the message beside the form
   that failed (an `?error=` code, the pattern the inspection photo upload uses), keeping what was
   typed. `required` on the submittal ref/title and product name.
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
- "Today" is the Saudi date (UTC+3), as everywhere else in the Material Review.
