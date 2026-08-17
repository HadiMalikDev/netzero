# Mistakes

## 2026-08-17 — AI verify mutated deterministic fields with no regression gate

**What happened:** The "verify & complete with AI" step was allowed to overwrite `pointsRaw` and add
requirements in place, with nothing checking the result. Across three review rounds it kept fixing the
named defects while silently breaking neighbours — phantom keystone/footnote rows, a credit's Total
migrating into requirement #1's points (HC-02 1→3, W-03 1→2), text severed at a mid-sentence digit
(TC-03 "…from **3** additional amenities"). My "fix" for one round was to re-parse deterministic-only,
which killed the corruption but also discarded every AI-added `numericSpec`/metric_type — a net
regression a reviewer caught (numericSpec coverage 25→2).

**Root cause:** Treated the points column as AI-editable when it is deterministic (it comes from the
manual's own table), and had no golden fixture / reconcile gate to block a write that made a
previously-correct row wrong. Also a deterministic bug: the header "Points Allocated" value is the
CREDIT total on single-line/`#1 & #2` headers, but I applied it as requirement #1's points.

**Prevention:** (1) The points column is deterministic — the AI proposes text/metric/measurable only,
never points. (2) Additions pass a reconcile gate: keep only if they move the credit's sum toward its
Total, never past it. (3) Trust the header points solely when it lists a line per requirement
(`headerCount >= reqCount`). (4) Reconcile is recomputed from the FINAL rows after apply, never left
stale. The durable version of (2) is a frozen golden fixture with per-row expected values — still to
build; the reconcile invariant (0 mismatches) is the interim gate.



## 2026-08-17 — Overfit the extractor to the one PDF on disk

**What happened:** Building "extractor v2" I hardcoded Commercial‑D+C specifics into the parser — the
7 typologies and 4 scopes (`TYPOLOGIES`/`SCOPES`), the 9 category prefixes (`KNOWN_PREFIXES`), the 9
category display names, and the exact evidence-stage labels ("Design Stage Evidence" / "Construction
Stage Evidence"). The client pushed back: it must generalize across all Mostadam PDFs, not score 100%
on the one supplied. Probing the public Commercial **O+E** manual confirmed the failure: it uses
prefixes not in the allowlist (A, CFC, GC, GS, HFC, I, K, OS, R, TM) and **no** Design/Construction
stage labels — so the parser would miss most credits and extract zero evidence on it.

**Root cause:** Optimized to the single available test document; treated one PDF's vocabulary/layout
as the schema instead of detecting it. Confirmation bias from validating only against D+C.

**Prevention:** For document extractors, **detect every vocabulary from each document** (typologies,
scopes, category codes/names, evidence-stage labels, totals, keystone list); anchor only on the
family's shared *template structure*; use **reconcile-or-fail as per-document self-validation**; and
**validate against multiple documents of the family** (D+C *and* O+E, + addendum) before calling it
done. Prefer the LLM for layout-variant normalization over hand-tuned regex.



## 2026-08-16 — Reached for regex to detect manual metadata instead of the LLM

**What happened:** To seed catalog metadata (org / scheme / stage / version) from an uploaded manual, I started building regex/heuristic detection over the extracted PDF text. The client interrupted: "detection should be offloaded to LLM."

**Root cause:** Defaulted to deterministic parsing out of habit, even though the target data (title/version) lives on a cover image that extracts poorly and the body contains misleading year references — exactly the fuzzy, OCR-degraded case where regex is brittle and an LLM excels.

**Prevention:** For extracting facts from unstructured or poorly-extracted document text (titles, versions, org names), prefer an LLM call with a constrained JSON schema over regex; keep the deterministic detector only as a fallback. Reserve regex for well-structured, reliably-extracted layout (e.g. the credit-header split).

## 2026-08-16 — Deferred the spec parser out of Stage 1

**What happened:** Proposed hand-entering HC-10 and parking document upload/parse for a later slice. Client pushed back: the parser has to be set up in Stage 1.

**Root cause:** Treated parse risk (messy PDFs) as a reason to cut the feature, instead of treating it as the product’s stated setup path. Over-corrected the previous pack’s over-scoping.

**Prevention:** The brief’s first-stage path is create project → upload spec → derive checklist. Build a real Mostadam-layout parser; don’t substitute hand-entry.

## 2026-08-16 — “HC-10 fixture” sounded like hardcoding one credit

**What happened:** Called HC-10 “the fixture / acceptance test.” Client read that as: we only extract HC-10, so PDF extraction is theater.

**Root cause:** Used test-jargon (fixture) for the *known-good check*, without saying the parser must walk the whole uploaded manual and emit every credit it can find.

**Prevention:** Say it in product language: upload a spec PDF → extract all credits/requirements in that file. HC-10 is one credit we already know, used to *verify* the extract — not the only thing we parse.
