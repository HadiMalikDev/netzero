# Sprint 1 — Client Feedback Log (Jeddah Central Oceanarium)

Source: [`source/NetZero_Platform_Feedback_Log.pdf`](./source/NetZero_Platform_Feedback_Log.pdf)
Prepared by client: 2026-08-31 · Audited: 2026-09-04 · Status: **audit complete, nothing built yet**

Project context: Jeddah Central Oceanarium — Mostadam Commercial D+C v1.0-2019, Design Stage.

## How this folder works

One subfolder per row of the feedback table. Each contains:

- `task.md` — the request as raised, what the audit found, root cause, and the proposed change.
- `evidence/` — screenshots captured from the running app during the audit.

When an item is built, append a "Done" section to its `task.md` and drop the
after-screenshots into the same `evidence/` folder alongside the before ones.

## Audit method

A local Postgres cluster was stood up, the Commercial D+C manual was parsed
through the real parser, and all 56 credits were promoted into the catalog. Two
projects were created through the wizard ("Jeddah Central Oceanarium" and
"Riyadh Marina Tower") and every item below was exercised in a real Chromium
session via Playwright. No application code was changed.

## Status at a glance

| # | Item | Type | Verdict | Effort |
|---|------|------|---------|--------|
| 1 | Evidence labelled "Optional" | Correction | Confirmed | XS |
| 2 | Multiple attachments per credit | Feature | Already works in storage, invisible in UI | S |
| 3 | "Additional Attachments" option | Feature | Same fix as 2 | XS |
| 4 | PMM-03 attachment not visible | Bug | Confirmed, but the file does upload | S |
| 5 | Delete an attached file | Feature | Confirmed missing | S |
| 6 | AI review of the uploaded document | Feature | Not built, plumbing exists | L |
| 7 | Dashboard cards not clickable | Bug | Confirmed | XS |
| 8 | Excel scorecard export | Feature | Not built | M |
| 9 | Required-documents checklist per credit | Feature | Data already parsed, never rendered | S |
| 10 | Documents visible under the credit | Feature | Confirmed missing | S |
| 11 | Progress dials | Feature | Not built, points already computed | M |
| 12 | Credit tab not working | Bug | Reproduced, different cause than reported | XS |
| 13 | Upload more docs on an ongoing credit | Feature | Already works, invisible | — |
| 14 | Checkbox per sub-requirement | Feature | Partly built | M |

## The single biggest finding

Items 2, 3, 4, 5, 10 and 13 are one defect, not six. Uploads already work
end-to-end. The database stores many files per requirement, and both test files
landed correctly. The credit screen simply never renders the list — it prints
`required · 2 attached` and stops. There is also no route that serves an
uploaded evidence file back to the user, so no attachment can be opened or
downloaded anywhere in the product.

Building one attachment list component (filename, size, download link, delete
button) under each requirement closes six of the fourteen rows.

## Suggested order

**Quick wins — a day, roughly**
Items 1, 7, 12, then the shared attachment list covering 2, 3, 4, 5, 10, 13.

**Next — high value, contained**
Item 9 (the required-document checklist, whose data is already in the database),
then item 11 (progress dials) and item 8 (Excel export).

**Bigger builds — scope separately**
Item 6 (AI document review against credit requirements) and item 14
(per-requirement met/not-met model).
