# Sprint 1 — Client Feedback Log (Jeddah Central Oceanarium)

Source: [`source/NetZero_Platform_Feedback_Log.pdf`](./source/NetZero_Platform_Feedback_Log.pdf)
Prepared by client: 2026-08-31 · Audited: 2026-09-04 · V2 log received: 2026-10-05 · Status: **14 of 14 shipped**

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
| 3 | "Additional Attachments" option | Feature | **Shipped** — credit-level section in V2 |
| 4 | PMM-03 attachment not visible | Bug | **Shipped** |
| 5 | Delete an attached file | Feature | **Shipped** |
| 6 | AI review of the uploaded document | Feature | **Shipped** |
| 7 | Dashboard cards not clickable | Bug | **Shipped** |
| 8 | Excel scorecard export | Feature | **Shipped** in V2 |
| 9 | Required-documents checklist per credit | Feature | **Shipped** — made prominent in V2 |
| 10 | Documents visible under the credit | Feature | **Shipped** |
| 11 | Progress dials | Feature | **Shipped** in V2 |
| 12 | Credit tab not working | Bug | **Shipped** |
| 13 | Upload more docs on an ongoing credit | Feature | **Shipped** |
| 14 | Checkbox per sub-requirement | Feature | **Shipped** in V2 — read as "pick the path being pursued" |

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

## Regression check after the sprint

Every screen was re-opened in a browser after the last commit, with console
errors and 5xx responses treated as failures.

| Screen | Result |
|---|---|
| Dashboard, Projects | pass |
| Project overview, Credits list, Documents, AI Assistant | pass |
| Credit detail: PMM-03, W-02 (banded points), HC-10 (either/or group) | pass |
| Second project's credits | pass |
| Catalog admin | pass |
| All four credits-list filters | pass |
| No console errors, no 5xx | pass |

`pnpm build` succeeds, `tsc --noEmit` is clean, ESLint reports no errors (5
pre-existing warnings, untouched), and the suite is 70 passing with 6 skipped
database tests.

## V2 feedback (2026-10-05)

The client's second log, `NetZero_Platform_Feedback_Log V2.pdf`:

- marked rows 8, 9, 11 and 14 Pending;
- left row 3 unmarked;
- added a remark on row 12, which Hadi judged already done;
- said the AI review "will be polished further". That is not acted on until
  the client says what they want changed.

Hadi settled the open product questions:

- a target level per project, plus a targeted flag per credit;
- targeted points copy the credit's range;
- rating levels stored on the catalog version, Full Scope only;
- row 14 is about the either/or path being pursued;
- optional point rows never block a credit;
- additional attachments live at credit level.

Shipped on `feat/feedback-v2`, one commit per row, in dependency order:

| Commit | Row | Change |
|---|---|---|
| `4e8df38` | 14 | Either/or path picker; optional point rows stop blocking completion; the assistant labels them optional |
| `318c4df` | 14 (fix) | A credit's only point-earning row is not optional (PMM-03) |
| `d848951` | 9 | One Required documents box at the top of the credit, with stage tags |
| `e3aff55` | 3 | Credit-level Additional attachments, reviewed against the whole credit |
| `f785bfc` | 11 | Target level, targeted credits, rating levels in the catalog, project gauge, credit ring |
| `e28f2ff` | 8 | Excel scorecard export |

Three additive migrations:

- `0004`: `requirement_entry.planned`.
- `0005`: `evidence_doc.project_credit_id`, backfilled; `requirement_entry_id`
  becomes nullable.
- `0006`: `project.target_tier`, `project_credit.targeted`,
  `rs_version.tier_thresholds`, seeded for Commercial D+C.

### Regression check after V2

All 25 screens returned 200, with console errors and 5xx treated as failures:

- dashboard and projects list;
- both projects' overview and credits;
- documents and the assistant;
- PMM-03, W-02, HC-10 and E-01;
- the workspace-wide credits, documents and assistant;
- catalog admin and a version page;
- the wizard and the remaining "soon" screens;
- all five credits-list filters.

`pnpm build` succeeds and `tsc --noEmit` is clean. ESLint reports no errors
(the 5 existing warnings are untouched). The suite is 121 passing with the
database tests on.

### Found along the way, not changed

- **Credit Totals.** The catalog's credit Totals sum to 131 against the
  manual's 130 Full Scope. One credit's Total is off by a point (row 11 notes).
- **Missed groups.** EI-03 and TC-01 each show a lone "Option 1"; the parser
  likely missed their either/or groups (row 14 notes).
- **Made-up link domains.** In LLM mode the assistant sometimes writes absolute
  links on made-up domains instead of the relative paths it is given (row 14
  notes).
- **Documents don't gate completion.** The Required documents count still does
  not gate a credit's completion (row 9 notes).
