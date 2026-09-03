# 10 — Uploaded documents should be visible under the relevant credit

**Type:** Feature · **Verdict:** Confirmed missing · **Effort:** S

## As raised

> Uploaded documents should be visible directly under the relevant credit, not
> buried elsewhere, so evidence is immediately traceable to its credit.

## What the audit found

This is precisely what the product does wrong. The credit screen shows a count.

![count, not files](./evidence/credit-shows-count-not-files.png)

The files themselves live on a separate Documents tab, one level away from the
credit they belong to.

![separate library](./evidence/files-only-in-separate-library.png)

The library does say which credit and requirement each file belongs to, so the
traceability exists in the data. It reads in the wrong direction: from the file
to the credit, when the user is on the credit asking what has been provided.

Neither screen offers a way to open a file. The filenames are plain text.

## Root cause

Evidence display was built as a project-wide library and never mirrored onto the
credit. The requirement row was given a counter instead of a list.

## Proposed change

Render the attachment list inline under each requirement. Keep the Documents tab
as the cross-project roll-up, which is useful in its own right, and add download
links to both.

This is the same component as items 2, 3, 4, 5 and 13. Building it once closes
all six.

---

## Done — 2026-09-04

Evidence is now listed directly under the requirement it belongs to, which is
where the user is standing when they ask what has been provided.

![attachments under the credit](./evidence/after-attachment-list.png)

The project Evidence Library is kept as the cross-credit roll-up, and its
filenames are now links too. Previously they were plain text, because no route
existed to serve a stored file.

![documents tab with links](./evidence/after-documents-tab-links.png)

So traceability now reads in both directions: from the credit to its files, and
from a file back to its credit.

### Verified

| Check | Result |
|---|---|
| Files listed under the requirement, by name | pass |
| Each name opens the stored file | pass, 200 |
| Size and upload date shown per file | pass |
| Documents tab filenames are links | pass |
| Both screens agree after a removal | pass |
