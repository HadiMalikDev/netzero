# 7 — Dashboard top cards are not clickable

**Type:** Bug · **Verdict:** Confirmed · **Effort:** XS

## As raised

> Dashboard top cards are not clickable/responsive — clicking them produces no
> action or reaction.

## What the audit found

Confirmed. The four cards are presentational only.

![dashboard cards](./evidence/dashboard-kpi-cards.png)

Scripted inspection of each card:

| Card | Wrapped in a link | Click handler | Cursor |
|---|---|---|---|
| Active Projects | no | no | default |
| Credits Completed | no | no | default |
| In Progress | no | no | default |
| Missing Evidence | no | no | default |

Clicking "Active Projects" left the URL unchanged at the dashboard.

![full dashboard](./evidence/dashboard-full-page.png)

## Root cause

The shared tile component renders a card with a label, a value and a hint. It
accepts no destination and has no interactive behaviour. The same component is
reused on the project overview and the credits list, so all three screens have
the same dead cards.

## Proposed change

Give the tile an optional destination and render it as a link when one is
supplied, with hover and focus states. Then wire the four dashboard cards:

| Card | Should open |
|---|---|
| Active Projects | the projects list |
| Credits Completed | credits filtered to Completed |
| In Progress | credits filtered to In Progress |
| Missing Evidence | credits filtered to those missing a required file |

The credits list already has working Completed / In Progress / Not Started
filters, so the first three destinations exist today. "Missing evidence" is not
currently a filter option and would need adding.

Fixing the shared component fixes the project overview and credits list at the
same time, which is why this is the cheapest item on the list.
