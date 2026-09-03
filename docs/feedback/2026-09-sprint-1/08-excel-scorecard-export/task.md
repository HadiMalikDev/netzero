# 8 — Excel export of the scorecard

**Type:** Feature · **Verdict:** Not built · **Effort:** M

## As raised

> After uploading a scorecard or creating a new project, there should be an
> option to download an Excel export containing: all credits with total available
> points and targeted points; current status per credit; and credits that are not
> targeted, clearly labeled as such.

## What the audit found

No export control exists on any project screen. A scripted search across the
credits list, project overview and reports screen for "export", "Excel", "xlsx"
or "download" returned zero matches.

![credits list, no export](./evidence/credits-list-no-export-button.png)

The Reports screen is an explicit placeholder.

![reports stub](./evidence/reports-screen-stub.png)

## What already exists to build on

Most of the content the client asked for is already computed and on screen. The
credits list shows every credit with its earned and available points, its
requirement count, its category grouping and its derived status.

There is also a working precedent for generating and serving a document: the
catalog review export builds a PDF on demand and returns it as a download. The
same route shape works for a spreadsheet.

## The gap worth flagging

The request assumes a concept the product does not have: **targeted points**.
Today a project instantiates every credit in the rating-system version and there
is no way to mark a credit as targeted or not targeted. Both requested columns
("targeted points" and "credits not targeted, clearly labeled") therefore have
no data behind them.

Two ways forward:

1. **Ship the export against what exists now** — every credit, available points,
   earned points, status, category. Useful immediately, and it does not answer
   the targeting half of the request.
2. **Add credit targeting first**, then export. A per-credit "targeted" flag with
   a targeted-points figure, which also feeds the certification-level dial in
   item 11.

Recommendation: option 2, because item 11 needs the same concept. A dial showing
"progress toward target" is meaningless without a target. Doing targeting once
serves both rows.

No spreadsheet library is currently a dependency; one would need adding.
