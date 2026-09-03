# Sprint 1 — Client Feedback Log (Jeddah Central Oceanarium)

Source: [`source/NetZero_Platform_Feedback_Log.pdf`](./source/NetZero_Platform_Feedback_Log.pdf)
Prepared by client: 2026-08-31 · Audited: 2026-09-04 · Status: **11 of 14 shipped**

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
session via Playwright.

## Status at a glance

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | Evidence labelled "Optional" | Correction | **Shipped** |
| 2 | Multiple attachments per credit | Feature | **Shipped** |
| 3 | "Additional Attachments" option | Feature | **Shipped** |
| 4 | PMM-03 attachment not visible | Bug | **Shipped** |
| 5 | Delete an attached file | Feature | **Shipped** |
| 6 | AI review of the uploaded document | Feature | **Shipped** |
| 7 | Dashboard cards not clickable | Bug | **Shipped** |
| 8 | Excel scorecard export | Feature | Open — needs your decision |
| 9 | Required-documents checklist per credit | Feature | **Shipped** |
| 10 | Documents visible under the credit | Feature | **Shipped** |
| 11 | Progress dials | Feature | Open — needs your decision |
| 12 | Credit tab not working | Bug | **Shipped** |
| 13 | Upload more docs on an ongoing credit | Feature | **Shipped** |
| 14 | Checkbox per sub-requirement | Feature | Open — needs your decision |

Each shipped row has a "Done" section at the bottom of its `task.md` with the
change, the decisions taken, before/after screenshots and the checks that were
run in a browser.

## The single biggest finding

Items 2, 3, 4, 5, 10 and 13 are one defect, not six. Uploads already work
end-to-end. The database stores many files per requirement, and both test files
landed correctly. The credit screen simply never renders the list — it prints
`required · 2 attached` and stops. There is also no route that serves an
uploaded evidence file back to the user, so no attachment can be opened or
downloaded anywhere in the product.

Building one attachment list component (filename, size, download link, delete
button) under each requirement closes six of the fourteen rows.

## What shipped

Five commits on `feat/feedback-sprint-1`, easiest first:

1. **Row 12** — sidebar Credits/Documents/Assistant follow the open project
   instead of always resolving to the first project in the workspace.
2. **Row 7** — metric tiles are links that drill into the filtered credits list,
   plus a new "missing evidence" filter for the fourth tile.
3. **Row 1** — evidence is required on every requirement, and can no longer be
   closed without a file.
4. **Rows 2, 3, 4, 5, 10, 13** — the attachment list, a route that serves a
   stored file, multi-file upload and delete.
5. **Row 9** — the required-documents checklist, with each attachment linked to
   the document it provides.
6. **Row 6** — the AI read of an uploaded document against its requirement,
   advisory only, quoting the document or staying silent.

Two additive migrations: `0002` adds a nullable `evidence_spec_index` to
`evidence_doc`, `0003` adds the `evidence_review` table.

## What is left, and why

**Rows 8, 11 and 14 need a product decision from you.** Rows 8 and 11 both
assume *targeted points* and a *target certification tier*, which the product
has no concept of — a dial showing "progress toward target" is meaningless
without one. Row 14 needs a ruling on whether an explicit met/not-met tick may
override the derived status the whole scoring model rests on.
