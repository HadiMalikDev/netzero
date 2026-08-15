# Mistakes

## 2026-08-16 — Deferred the spec parser out of Stage 1

**What happened:** Proposed hand-entering HC-10 and parking document upload/parse for a later slice. Client pushed back: the parser has to be set up in Stage 1.

**Root cause:** Treated parse risk (messy PDFs) as a reason to cut the feature, instead of treating it as the product’s stated setup path. Over-corrected the previous pack’s over-scoping.

**Prevention:** The brief’s first-stage path is create project → upload spec → derive checklist. Build a real Mostadam-layout parser; don’t substitute hand-entry.

## 2026-08-16 — “HC-10 fixture” sounded like hardcoding one credit

**What happened:** Called HC-10 “the fixture / acceptance test.” Client read that as: we only extract HC-10, so PDF extraction is theater.

**Root cause:** Used test-jargon (fixture) for the *known-good check*, without saying the parser must walk the whole uploaded manual and emit every credit it can find.

**Prevention:** Say it in product language: upload a spec PDF → extract all credits/requirements in that file. HC-10 is one credit we already know, used to *verify* the extract — not the only thing we parse.
