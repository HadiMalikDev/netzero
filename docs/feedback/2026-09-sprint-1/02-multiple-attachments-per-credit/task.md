# 2 — Multiple attachments per credit, with upload and remove

**Type:** Feature · **Verdict:** Already works in storage, invisible in the UI · **Effort:** S

## As raised

> The system must support multiple attachments per credit, not a single file
> only. Upload and remore option should be there

## What the audit found

Multiple attachments already work. Two different files were uploaded to the same
requirement on PMM-03 during the audit. Both were written to disk, both created
database rows, and both appear in the project's Evidence Library.

![both files stored](./evidence/both-files-stored-documents-tab.png)

What the credit screen shows after those two uploads is a counter and nothing
else.

![counter only](./evidence/two-files-attached-counter-only.png)

The evidence table is already a one-to-many relation keyed on the requirement
entry, so nothing in the schema limits a requirement to one file. There is no
storage work to do here.

## Root cause

The requirement row renders `required · N attached` and never renders the list
of files behind that number. The reporter had no way to tell whether a second
upload replaced the first or was added alongside it.

## Proposed change

Render the attachment list under each requirement: filename, size, upload date,
a download link and a remove button. This is the same component that closes
items 3, 4, 5, 10 and 13.

Serving the file back also needs a new route. Nothing in the product currently
returns an uploaded evidence file to the browser, so a download link has nothing
to point at yet.

---

## Done — 2026-09-04

Many files per requirement are now visible, and each can be opened or removed.
Storage always supported this; the screen did not show it.

The file input takes a multiple selection, so two or three documents attach in
one go rather than one per click. The audit selected two files at once and both
landed.

![three files listed](./evidence/after-attachment-list.png)

After removing the superseded one:

![after remove](./evidence/after-remove.png)

The "remove" half of this row is documented in
[row 5](../05-delete-attached-file/task.md); the shared component and the new
evidence-serving route are described in
[row 4](../04-pmm03-attachment-not-visible/task.md).

### Verified

| Check | Result |
|---|---|
| Two files attach from one selection | pass |
| All three names, sizes and dates listed | pass |
| Badge follows the count | pass, 0 → 1 → 3 → 2 |
| Each filename opens the stored file | pass, 200 |
| Removing one leaves the others | pass |

### Final shipped appearance

Row 9 landed after this one and folded the attachment list into a
required-documents checklist, so the screen now looks like this. Files sit under
the document they provide, with unassigned ones grouped as "Other attachments".
Everything verified above still holds.

![shipped UI](./evidence/after-shipped-ui.png)
