# 6 — AI review of an uploaded document against the credit requirement

**Type:** Feature · **Verdict:** Not built · **Effort:** L

## As raised

> After a document is uploaded, the AI should automatically review the full
> document against the relevant credit's requirements. Specifically for plans
> (e.g. Labor Subsistence Plan), it should assess and flag whether the plan meets
> or does not meet the credit requirement.

## What the audit found

Uploading a document produces no analysis of any kind. The upload writes a file,
inserts a row, and refreshes the page.

![no review after upload](./evidence/no-review-after-upload.png)

## What already exists to build on

This is the largest item on the list, but not a greenfield one.

- A PDF text extractor is already a dependency and is used by the manual parser.
- A language-model client with a JSON-mode helper and a deterministic fallback
  is already in place, along with a working example that generates grounded
  reviewer notes for the catalog export.
- The requirement text, its aim, its metric type and its list of expected
  evidence documents are all in the database and are exactly what a reviewer
  would compare a plan against.

What is missing is the pipeline: extract text from the uploaded file, chunk it,
prompt against the requirement, store a verdict, and surface it.

## Proposed change

A queued review that runs after upload and stores, per attachment: a verdict of
met / partially met / not met / unreadable, a short rationale, and quotes from
the document supporting the verdict.

Constraints worth writing into the spec now:

- **Advisory, never authoritative.** The verdict must not drive credit status.
  The existing status engine is derived from user-entered values and file
  presence, and an AI opinion must not silently change a compliance state. Show
  it as a reviewer aid the user can accept or dismiss.
- **Cite or stay silent.** Every claim should quote the document. The house rule
  established in the catalog parser work is that the model normalises and
  assesses, it does not invent thresholds or point values.
- **Handle the unreadable case.** Scanned drawings and image-only PDFs will not
  yield text. Say so plainly rather than guessing.
- **Asynchronous.** A full plan will not review inside a form submission. Upload
  must stay fast, with the verdict arriving after.

Recommend scoping this as its own slice after the quick wins land.
