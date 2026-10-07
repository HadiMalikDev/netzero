# Sprint 2 — Generated compliance checklists

Raised: 2026-10-07 · Built: 2026-10-07 · Status: **3 of 3 shipped on `feat/compliance-checklist-pdf`, not yet merged**

Project context: Jeddah Central Oceanarium — Mostadam Commercial D+C v1.0-2019.

## How this folder works

Same as [Sprint 1](../2026-09-sprint-1/README.md): one subfolder per item, a
`task.md` with the request, the findings, the proposed change and the commit
plan, and an `evidence/` folder for before/after screenshots. When an item
ships, a "Done" section is appended to its `task.md` in the same commit.

## Items

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | [IAQ / ESC compliance checklist, generated as a PDF](./01-compliance-checklist-pdf/task.md) | Feature | **Shipped** — six commits, Done section in its `task.md` |
| 2 | [IAQ inspection sheet in the site team's format](./02-iaq-inspection-sheet/task.md) | Feature | **Shipped**, then superseded by item 3 (its code template moved into the database) |
| 3 | [Checklist forms in the database, AI-drafted and human-reviewed](./03-checklist-templates-in-db/task.md) | Feature | **Shipped** — seven commits, Done section in its `task.md` |

## Checked without a browser

Hadi asked for this one to be verified without Playwright. The route was
exercised with `curl` and a session cookie minted the way
`lib/auth/session.ts` mints one, the PDFs were downloaded from the running
dev server against the `netzero_v2` database, and each one was opened and
read page by page. The PDFs themselves are in the item's `evidence/` folder,
with a page-1 image of each.
