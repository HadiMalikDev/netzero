# 4 — Reports page: every generated report in one place

**Type:** Feature · **Effort:** S

## As raised (2026-10-11)

> Please enable the "Reports" subpage and put all generated reports (ESC and
> IAQ) there, along with all options that exist for that report on the
> credit's own page.

## Done — 2026-10-11

**Reports** is live in the sidebar (it was a "soon" placeholder) and is a new
tab beside Credits, Documents and AI Assistant. Like those, it is a project
page: the sidebar entry opens `/projects/<id>/reports` for the project you are
in, and from outside a project it resolves to the first one.

The page has one card per credit that has an inspection form — **HC-10 Indoor
Air Quality (IAQ)** and **SS-03 Construction Environmental Management (ESC)**
today, decided the same way as the credit's Inspections button (its own copy,
or a standard form matched by title). Each card carries the options the
credit's own pages have:

| Option | Same as on |
|---|---|
| Download checklist (PDF) — the compliance checklist | credit page |
| Edit form | Inspections page |
| New inspection | Inspections page (same action) |
| Environmental Observations (ESC) — with the open count | Inspections page, the log |
| Each inspection: date, inspected by, status, **Open / Review**, **Download PDF** | Inspections page and review page |

Re-run AI, answering and saving stay on the review page, which Review opens.
Every option goes through the same action or link as on the credit, so the
two places cannot disagree. Opening the page creates nothing: a project still
on the standard form is shown as such until it edits the form or starts an
inspection.

### Checks (no Playwright)

| Check | Result |
|---|---|
| `/reports` | 307 to `/projects/<first>/reports` |
| Jeddah's Reports page | 200; IAQ and ESC cards with their form titles; checklist, Edit form and New inspection on both; observations log on ESC; Reports tab present |
| New inspection submitted from the Reports page (real form) | 303 to the review page |
| After the review is saved | the row shows its date and a Download PDF link; the link returns the PDF (200) |
| Database tests | only credits with a form are listed; nothing is copied by viewing; inspections newest first with review state; open observations counted |
| Full suite with database / tsc / lint / build | 218 passing / clean / 0 errors / succeeds |

Test data removed afterwards.
