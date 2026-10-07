# 3 — Checklist forms in the database, AI-drafted and human-reviewed

**Type:** Feature · **Effort:** L · Supersedes the code-based template of [item 2](../02-iaq-inspection-sheet/task.md)

## As raised

Research for Hadi (2026-10-08) showed IAQ and ESC checklists are
**project-specific**: each comes out of a plan the contractor writes for that
project (an IAQ Management Plan following SMACNA; an ESC plan or CEMP for the
site). The rating system fixes the headings, not the items. Item 2 had put the
Jeddah contractor's items in code, shared by every project.

> Design a system that stores the template format — the list of questions per
> checklist — in the database against a project, and the download button
> generates the PDF on the fly. Seed the current IAQ checklist content.
>
> When you click the button it should show a preview of the responses filled
> by the AI. The admin can keep that response or override it, then download
> the resulting PDF.

Decisions (Hadi, 2026-10-08):

| Question | Answer |
|---|---|
| What does the AI suggest when the plan does not mention an item? | **Leave it blank.** It suggests Yes (with the plan's sentence) or N/A (only if the plan says so), never No: silence in a plan is not a failure on site |
| Does the PDF show which answers came from the AI? | **No, final answers only**, with "Responses reviewed by <name> on <date>"; AI vs override is kept in the database |
| Which photos go in an inspection's PDF? | **All photos on the credit** |
| Template editor? | **Included** |
| Browser checks | **No Playwright**: curl, database tests and downloaded PDFs |

## Design

| Table | Holds |
|---|---|
| `checklist_template` | One form. No `project_credit_id` = workspace default, matched to a credit by title; with one = a project's own copy. Title, confirmation text, and which required documents are the plan (read by the AI) and the completed sheet (gives the stage) |
| `checklist_section`, `checklist_item` | Headings and questions in order; an item is switched off, never deleted |
| `checklist_inspection` | One filled copy: date, inspector, area, the AI draft's state, who reviewed it and when |
| `checklist_response` | One per item: number, heading and text copied in at the start, the AI's suggestion and quote, the final answer, the remark |

Numbering (1.1, 1.2…) is computed from order. Copying the item text into each
response means editing the form later never rewrites a past inspection.

Flow: credit page → **Inspections** (list, *New inspection*, *Edit form*) →
*New inspection* copies the default into the project if needed, snapshots the
active items, and starts the AI draft in the background → the review page shows
each item's suggestion and quote, pre-selected, with Yes / No / N/A / blank and
a remark to keep or override → *Save* records the reviewer → *Download PDF*.

## Commits

| # | Commit |
|---|---|
| 1 | Schema and migration `0008` (five additive tables) |
| 2 | Seed migration `0009` (the IAQ default) and the data layer: default lookup, copy to project, start an inspection, save responses; database tests |
| 3 | AI draft per inspection, from the existing verified plan read |
| 4 | Inspections list and review page |
| 5 | PDF from a saved inspection; the code template, its route and button removed |
| 6 | Form editor |
| 7 | Done section, evidence |
