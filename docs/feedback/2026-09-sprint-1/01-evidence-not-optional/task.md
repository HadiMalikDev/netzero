# 1 — Evidence upload must not be labelled "Optional"

**Type:** Feature / Correction · **Verdict:** Confirmed · **Effort:** XS

## As raised

> Evidence upload should not be marked "Optional." Wherever the platform
> currently labels evidence upload as optional, it should be changed to
> mandatory/required.

## What the audit found

The label is real. On credit W-02 the evidence row reads `Evidence (optional)`
next to the Attach file button.

![current label](./evidence/current-optional-label-W-02.png)

The label is not a hardcoded string — it is driven by whether the parser found a
list of required evidence documents for that requirement. In the seeded
Commercial D+C catalog:

| Requirements | Count |
|---|---|
| Total | 99 |
| With a parsed evidence list, shown as "required" | 93 |
| With an empty evidence list, shown as "(optional)" | 6 |

The six sit in four credits: E-04, HC-16, MW-06 and W-02 (3 of its 5).

## Root cause

`requiresEvidence` is derived as "the extract listed at least one evidence
document". Where the parser returned an empty list, the app concludes evidence
is optional. That is a parser gap being presented to the user as a policy
statement. Mostadam requires evidence for every credit being claimed.

Two files are involved: the label in the requirement row component, and the
derivation in the data layer. The derived-status rule also treats those six
requirements as completable with no file at all, which is the more serious half
of this bug.

## Proposed change

1. Change the label from "(optional)" to "required" everywhere.
2. Flip the default so a requirement with no parsed evidence list is still
   treated as requiring evidence, rather than the reverse.
3. Keep showing the parsed document list where one exists (see item 9).

Because the status engine keys off the same flag, this change also stops those
six requirements from being marked complete with nothing attached.
