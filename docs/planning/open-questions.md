# Open Questions & Clarifications

Grouped by how much they block planning. **P0 = answer before we finalize the plan / start building.**

---

## ✅ Decisions locked (2026-08-16)
The four P0 blockers are resolved:
1. **Setup = catalog-first.** MVP uses a hand-curated Mostadam catalog; document ingestion (upload spec → derive checklist) is **Stage 2**.
2. **First scheme = Mostadam Commercial D+C** (130-pt, contains HC-10). Seed this fully first.
3. **Mostadam-only at launch**, architecture kept multi-standard-ready.
4. **Multi-tenant SaaS** — isolated org/workspace per company from day one; billing can come later.

→ These are reflected in [`../product/mvp-stage-1.md`](../product/mvp-stage-1.md) and [`roadmap-and-sprints.md`](./roadmap-and-sprints.md). **Next up: the P1 items below** (not blockers, but needed early).

---

## P0 — Scope & priority (RESOLVED — see above, kept for context)

1. **Document ingestion in MVP or Stage 2?**
   You described uploading a spec (like HC-10) and *deriving* the checklist from it. The reference app doesn't do this — it's catalog-driven (pick a rating system → known credits load). Our recommendation: **MVP = catalog-driven** (we hand-curate the Mostadam catalog for reliability), with **document-parsing as Stage 2**. Is that acceptable, or is "upload any spec → auto-build checklist" a must-have for v1?

2. **Which Mostadam scheme(s) to seed first?** Mostadam has Residential (O+E and D+C), Communities, and Commercial (D+C, 7 typologies). Your `HC-10` example is **Commercial D+C**. Which do your real projects use most — Commercial, Residential, or both? We'd seed one fully first.

3. **Is it Mostadam-only at launch, or multi-standard from day one?** The reference offers LEED/Mostadam/EDGE/WELL/BREEAM. We recommend **Mostadam-first**, architecture multi-standard-ready. Confirm?

4. **Single organization or multi-tenant SaaS?** Is this an internal tool for one firm, or a product multiple companies sign up for? (Affects auth, billing, data isolation.)

5. **AI assistant scope confirmation.** We're scoping the MVP assistant as a **grounded aggregator** — answers "what's left/at risk" strictly from your project data, with citations, and *refuses to invent* requirements or predictions. Generative features (writing submission narratives, free-form predictions) are Stage 3. Agree?

---

## P1 — Product decisions (needed early, not day one)

6. **Do you have the official Mostadam manuals / "Credit Tools"?** We worked from the public **2019** manuals. Two things would sharpen accuracy: (a) confirmation these are the current versions (any newer revision on mostadamksa.org?), and (b) the **Energy Tool / Water Tool** spreadsheets — some NUMERIC scoring bands are computed inside those tools and we'd otherwise approximate. Can you share them, or a sample completed submission?

7. **Progress metric: points-weighted or credit-count?** Should "74% complete" mean 74% of *credits* done, or 74% of *achievable points* earned? (Reference shows both styles.) Points-weighted is more meaningful; confirm preference.

8. **Auto-derived status vs manual override.** We plan for status/score/tier to be **derived** from requirement values + evidence (not free-typed). Do you also need a manual override (e.g. mark a credit "complete" pending an offline sign-off)?

9. **Who are the real users & roles?** Confirm the persona list (Sustainability Manager/AP, discipline leads, executive owner, later subcontractors) and what each is allowed to edit. Any approval/sign-off workflow required for MVP?

10. **Arabic / RTL — needed for MVP or later?** Your market is KSA. Do launch users need Arabic UI, or is English acceptable for v1?

11. **Buildings & multi-building scoring.** A project can have multiple buildings. Is certification tracked per-project, per-building, or both — and how do points aggregate across buildings? (We defaulted to project-level for MVP.)

---

## P2 — Delivery & logistics

12. **Timeline & team.** Target launch date? Who's building (just Claude/you, or a wider team)? This calibrates the sprint plan in [`roadmap-and-sprints.md`](./roadmap-and-sprints.md).

13. **Tech/infra preferences.** Any constraints on database, auth provider, file storage, or hosting (e.g. must be hosted in KSA/region for data residency)? Otherwise we'll propose Postgres + an ORM + an S3-compatible store.

14. **Design fidelity.** Do we follow the reference app's look closely, do you have brand assets, or is design open? (There may be a fuller Figma file behind the shared prototype — can you share edit access?)

15. **Sample real project data.** Can you share one anonymized real Mostadam project (its target tier, the credits pursued, sample evidence)? Invaluable for UAT and getting the model right.

---

## What we're assuming unless you say otherwise
- Mostadam-first, English UI, single scheme seeded first (Commercial D+C if unspecified), catalog-driven setup, grounded aggregator AI, points-weighted progress, project-level certification, derived statuses with an optional manual override. We'll proceed on these defaults if we don't hear back — but the **P0** items genuinely change the plan.
</content>
