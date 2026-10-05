# 9 — Show a checklist of required documents per credit

**Type:** Feature · **Verdict:** Data already parsed, never rendered · **Effort:** S

## As raised

> A checklist of required documents should be shown per credit (list of required
> documents / checkbox format), so the user can see at a glance what's needed and
> what's been provided.

## What the audit found

Nothing of the sort is displayed. A credit screen shows the requirement text, an
input, and an attach button.

![W-02](./evidence/no-required-docs-list-W-02.png)
![PMM-03](./evidence/no-required-docs-list-PMM-03.png)

**The data is already in the database.** The manual parser extracts the required
evidence documents for each requirement and stores them, both as a plain list of
document descriptions and as a richer form tagged by certification stage.

| Requirements in the seeded catalog | 99 |
|---|---|
| Carrying a parsed list of required documents | 93 |
| Carrying an empty list | 6 |

A sample stored entry, from HC-10 requirement 1:

> "Specifications and/or contract documents specifying the requirement for the
> Contractor to develop and implement an IAQ Management Plan and building
> flush-out plan."
>
> "IAQ Management Plan with all control measures implemented during construction
> to minimize air pollution, and building flush out evidence."

The only thing missing is a component that renders it. This is the best
value-per-hour item on the list.

## Root cause

The field is read into the data layer and carried all the way to the requirement
view, then never used by any component.

## Proposed change

Under each requirement, render the parsed document list as a checklist. Each
row is one expected document, with a tick once a file has been attached against
it.

One decision to make: whether an attachment is linked to a specific expected
document or simply to the requirement. Linking each upload to the document it
satisfies is what makes the checkbox meaningful, and it means the upload form
needs to carry which slot is being filled. Without that link the ticks can only
reflect "something is attached to this requirement", which is weaker but far
cheaper.

Recommendation: ship the unlinked version first, since it renders data that
already exists and needs no schema change. Add per-document linking with item 14,
which raises the same modelling question.

The six requirements with an empty list are the same six that render as
"(optional)" in item 1. Fixing that item and this one together gives every
requirement either a real document list or an explicit "evidence required, list
not extracted from the manual" note.

---

## Done — 2026-09-04

Each requirement now shows the documents the manual asks for, as a checklist,
with what has been provided against each. The text is the parsed evidence table
verbatim — no new content was written.

Empty, on HC-10 requirement 1 (four required documents):

![checklist empty](./evidence/after-checklist-empty.png)

After attaching a file against the first document:

![one provided](./evidence/after-one-provided.png)

PMM-03 requirement 1, two of five provided, with an unassigned extra:

![two provided](./evidence/after-two-provided.png)

### The decision that was left open, and how it was settled

The audit flagged one question: does an attachment link to a *specific* expected
document, or just to the requirement? Without the link a tick can only mean
"something was uploaded here", which would mark every document provided the
moment one file arrived. That is a checkbox that lies, and worse than none on a
compliance screen.

So the link was built. `evidence_doc` gains one nullable column,
`evidence_spec_index`, pointing at a position in the requirement's parsed
document list. Migration `0002_overconfident_rockslide.sql`, additive only.

- Each checklist row has its own Attach control, so a file arrives already
  assigned to the document it provides.
- Files can still be attached without claiming a document. They appear under
  "Other attachments" and tick nothing.
- The column is nullable, so it can never block an upload, and every file that
  existed before this change simply reads as unassigned.
- An index pointing past the end of the list — possible if a catalog is
  re-parsed with fewer documents — degrades to unassigned rather than vanishing.

A tick therefore means that document was provided.

### Coverage

93 of the 99 requirements in the seeded Commercial D+C catalog carry a parsed
document list and get a checklist. The remaining 6 show the plain attachment
control, and are the same 6 that [row 1](../01-evidence-not-optional/task.md)
made evidence-required regardless.

### Verified

| Check | Result |
|---|---|
| The block renders with the manual's own wording | pass |
| Starts at "0 of 4 provided" on HC-10 | pass |
| Attaching against document 1 ticks only that row | pass, 1 of 4 |
| It does not tick every row | pass, exactly 1 tick |
| An unassigned file lands under "Other attachments" | pass |
| An unassigned file does not change the provided count | pass, still 1 of 4 |
| Removing the file un-ticks its row | pass, back to 0 of 4 |
| The unassigned file survives that removal | pass |
| PMM-03's five-document list behaves the same | pass, 2 of 5 |

### Follow-up left open

The "provided" count is not wired into credit scoring: a credit does not yet
require every listed document before it can complete. That is a scoring change
and belongs with [row 14](../14-per-requirement-checkbox/task.md), which raises
the same modelling question and is yours to decide.

## Done — 2026-10-05 (V2 feedback: make it prominent)

The V2 log still marked this row Pending, even though the checklist shipped in
Sprint 1. The likely reason is that it sat under each requirement, below the
value inputs and band tables, so on a long credit it was easy to miss. Hadi's
call: make it prominent.

### One box at the top of the credit

**Required documents** is now its own card, directly under the Aim and above
the Requirements Checklist. It is the first thing on the credit after the aim.

![PMM-03, Required documents at the top](./evidence/after-v2-pmm03-box-at-top.png)

- **One overall count** with a progress bar, "1 of 5 provided", across the
  whole credit.
- **Grouped by requirement** (#1, #2 …), each group with its own count. Every
  upload still lands against exactly one requirement and one document slot, so
  nothing about how files are stored changed.
- **Stage tags.** Each document carries the stage it belongs to (DESIGN STAGE /
  CONSTRUCTION STAGE). The manual extract already held it, and it explains
  lists like E-01's, where "Prescriptive Energy Tool" appears once per stage.
- **The AI review** still sits under each attached file.

![PMM-03 after attaching the Labor Subsistence Plan](./evidence/after-v2-pmm03-one-provided.png)

Each requirement row in the checklist now carries a compact chip ("required ·
1 of 5 documents") with a link that jumps up to its group in the box.

### How it follows row 14's planning

- **A set-aside either/or path** is left out of the box and named at the
  bottom ("Not listed: #2 Performance Option").
- **An optional row nobody has started** is listed with an "Optional · only if
  pursued" tag but not counted. Once started it reads "Optional · pursuing" and
  counts.

![E-01 with option #1 chosen](./evidence/after-v2-e01-set-aside-path.png)

![W-02: optional rows listed, not counted](./evidence/after-v2-w02-optional-not-counted.png)

### Still not wired into scoring

As before, a credit can reach Completed without every listed document being
provided: requirement status needs a value plus at least one file. W-02 above is
Completed while its box shows 0 of 2. Making the document count gate completion
is a scoring change that needs its own decision.

### Checks

- **Browser** (Playwright, project "Jeddah Central Oceanarium"):
  - section order is Aim > Required documents > Requirements Checklist;
  - PMM-03 goes 0 → 1 of 5 after uploading the Labor Subsistence Plan to slot 1;
  - the AI review rendered "appears to meet";
  - the chip jumps to the box;
  - W-02 and E-01 counts are correct;
  - no console errors, no 5xx.
- **Unit tests:** `tests/evidence.test.ts` (document counting and scope) and
  `pathStates`. 98 passing.
- `tsc` clean; lint has no errors (the 5 existing warnings are untouched).
