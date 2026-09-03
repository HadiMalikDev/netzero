# 5 — Remove an attached file so superseded versions do not pile up

**Type:** Feature · **Verdict:** Confirmed missing · **Effort:** S

## As raised

> Need a removal/delete option for attached files, so outdated versions can be
> removed when replaced with updated ones instead of accumulating and consuming
> storage.

## What the audit found

There is no delete control anywhere in the product. Not on the credit screen:

![no delete on credit](./evidence/no-delete-control-on-credit.png)

And not in the project's Evidence Library, where the files are listed but carry
no actions at all:

![no delete in library](./evidence/no-delete-control-in-library.png)

A scripted search of both screens for any control matching "remove" or "delete"
returned zero matches.

## Root cause

Never built. The upload path writes a file and inserts a row; there is no
counterpart that removes either one.

## Proposed change

Add a remove action on each attachment in the list from item 2. It deletes the
database row and the file on disk.

Two decisions worth settling before building:

- **Hard delete or soft delete.** This is compliance evidence. A superseded
  revision that was already cited in a submission may need to remain
  retrievable. A soft delete with an "archived" state keeps the credit screen
  clean while preserving the audit trail. It does not, however, free storage,
  which is the reason the client gave for asking.
- **Who may delete.** Single-workspace today, so anyone can. Worth revisiting
  when roles land.

Recommendation: hard delete for now, matching the stated intent, and revisit if
an audit-trail requirement appears.
