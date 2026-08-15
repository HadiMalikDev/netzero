# Green Badger — Competitive Deep Dive

_Research compiled 2026-08-16 for the NetZero certification-compliance product. Green Badger (getgreenbadger.com) is the primary US reference product._

> **Note on sourcing:** getgreenbadger.com blocks automated fetching (HTTP 403), so the primary site could only be read through search-engine snippets and cached excerpts. Direct-quote fidelity is therefore lower for first-party pages than for third-party reviews/press. See **Confidence & gaps** at the end.

---

## 1. Company overview

**What it is.** Green Badger is a cloud-based SaaS platform that automates sustainability documentation for construction projects. Its historical core is **LEED documentation automation** — replacing the manual spreadsheets, email threads, and document-passing that general contractors traditionally use to track and prove LEED credit compliance. As of 2025–2026 it has repositioned as a broader "sustainability data backbone for AEC," spanning LEED, ESG/carbon reporting, and product/material research.

- **Founded:** 2013. **Founder & CEO:** Tommy Linstroth (frequently quoted; also authors much of the LEED guidance content).
- **HQ:** Savannah, GA (US). Serves projects across the USA and Canada.
- **Scale claims (2024 sustainability report / press):** 80% of the top-25 green construction firms use it; 550+ construction projects on the platform in 2024; 11,200+ total users worldwide (~20% YoY growth); 500+ LEED projects completed since founding.
- **Named customers:** Skanska, Clark Construction, Gilbane, Turner (cited across reviews/marketing — treat specific logos as marketing claims).

**Who it serves.**
- **General contractors (primary buyer)** — the field/office teams responsible for construction-phase LEED credits.
- **Sustainability consultants / LEED consultants** — who administer documentation across many projects.
- **Owners** — real-time visibility dashboards into project sustainability progress.
- **Architects** — added more recently via a "product research environment" for early material/embodied-carbon evaluation before procurement.
- Positioning line: _"built for general contractors and the architects and owners they collaborate with… the only platform built to serve every team member at every stage from first specification through owner turnover."_

**Core problem solved.** LEED construction documentation is enormously paperwork-heavy: teams reportedly spend **400+ hours/project/year** on manual LEED documentation, chasing subcontractors for product data and assembling submission packages by hand in spreadsheets. Green Badger centralizes this, auto-maps requirements to the chosen rating system, verifies products against a database, and produces review-ready export packages. Marketing claims: **cuts documentation time ~65–80%**, teams earn **~65% more LEED construction credits**, and **~50% achieve a higher certification level** (vendor figures — treat as directional).

---

## 2. Core product modules / features

Green Badger describes itself as bringing "LEED documentation, embodied carbon tracking, ESG reporting, waste management, IAQ inspections, materials tracking, and Contractor's Commitment workflows into one connected system." Modules:

### LEED credit tracking / documentation automation
- Real-time **credit dashboard** consolidating all credits for the project's rating system; **color-coded** progress (see §3).
- **Credit-specific documentation guidance** — described as "your own digital LEED consultant": per-credit instructions on what to submit and how to earn the point.
- **Auto-mapped requirements** across LEED versions (2009, v4, v4.1; marketing now references **v4 & v5**) so the user isn't manually building a checklist.
- **LEED calculator exports** built in: BPDO (Building Product Disclosure & Optimization), Low-Emitting Materials, and Construction & Demolition Waste calculators.
- **Activity tracking**: every entry/change auto-logged by person and date (audit trail), across unlimited team members.
- **Review-ready export** of documentation packages for the GBCI/LEED Online submission.

### Sustainable procurement / product & material data capture
- **Product database**: "instantly verify and document thousands of LEED v4-compliant products," logged automatically to the project. Captures attributes needed for credits: **EPDs, HPDs, Cradle-to-Cradle, Declare labels, recycled content %, distance from extraction/manufacture (regional/local), VOC content, and FSC/certified wood.**
- **Mobile product lookup**: scan a product **barcode** (or search) to instantly pull VOC content, MSDS/SDS sheets, and LEED v4 compliance; each scan is added to the project's product log.
- **Architect product research environment** (2025–26): early-stage material evaluation and embodied-carbon comparison _before_ procurement.
- **Direct database integrations**: Building Transparency (**EC3**) for EPDs/embodied carbon and the **HPD Collaborative** for health product declarations — "tens of thousands" of EPDs/HPDs.
- **Shared visibility**: approved materials are visible to the whole team in real time instead of emailing tracking logs around.

### Construction waste management tracking
- **Construction Waste Recycling** module: enter waste tickets as they arrive and **snap a photo of the ticket**; real-time diversion totals against waste-diversion goals; feeds the C&D Waste calculator/credit.

### Indoor air quality (IAQ) management
- **In-field IAQ inspections** created on mobile (iPad/iPhone/Android), documenting construction-phase protection measures for the **IEQ Construction IAQ Management Plan credits (IEQc3.1/3.2)**.
- Assign a **designated point person** for (e.g.) monthly IAQ inspections.
- Generates **instant IAQ management reports**.
- Same inspection engine also covers **Erosion & Sedimentation Control (ESC)** inspections. For inspection-type credits (no numeric threshold), the dashboard shows a **count of inspections created** rather than a point tally.

### ESG / carbon reporting
- **ESG dashboard** tracking carbon, energy, water, waste, **M/WBE** (minority/women-owned business participation), and wellness — visualized with **radial gauges (speedometer-style)**.
- **Embodied carbon module**: evaluate embodied carbon of materials; import embodied-carbon data from **EC3** or enter directly.
- **Operational/whole-carbon**: calculate emissions from energy, deliveries, commutes, and materials; categorize into **Scopes 1, 2, 3**.
- **Portfolio benchmarking**: set company waste/water/energy/carbon goals and benchmark projects against them.
- **Contractor's Commitment** workflow support (industry framework — carbon, wellness, waste, water, materials).
- **Corporate/client reporting**: export client-specific or corporate ESG reports (Excel or customized PDF) for monthly/annual reporting.

### Reporting / dashboards / audit-ready exports
- **Real-time dashboards** for both construction progress and LEED performance; keeps owners informed live.
- **Report customization** and **client-specific report exports** from the corporate dashboard.
- **Audit trail** (activity by person/date) underpins audit-ready documentation.
- **Review-ready LEED export** packages assembled from tracked data.

### AI (uncertain)
- One third-party review (DataDrivenAEC) attributes a proprietary LLM, **"Baili" (Badger AI LEED Intelligence), trained on LEED project data**, plus predictive analytics for supply-chain emissions/waste-reduction. The Architosh 2026 feature does **not** mention Baili/AI. **Treat Baili as unconfirmed by first-party sources.**

---

## 3. How it models a project and its credits/checklists (most relevant to our MVP)

This is the section most directly informing our data model and project-creation flow.

**Project creation / setup flow**
1. **Create an account and add your first project** (self-serve to create).
2. **Project activation requires a paid project license** — pricing is effectively **per-project**, and a proposal/details submission is part of activation (not pure self-serve billing).
3. On the **Project Details page**, select a **LEED Rating System Subtype** (e.g., BD+C, ID+C, and the version). This choice drives which credits/checklist the project gets.
4. **Version selection is per-credit-flexible**: the global project rating system is set on Project Details, but within an individual credit you can choose the version (e.g., a **dropdown in the top-right of the credit screen to use LEED v4.1** on that credit). This mirrors how real LEED projects mix v4 and v4.1 substitutions credit-by-credit — a notable modeling nuance.
5. **Add the project team** via a "Project Team" button on the dashboard → "invite new members," assign a **user role**, enter email(s), send invite links. Unlimited team members.

**Credit / checklist model**
- Selecting a rating system **auto-generates the full credit list** (prerequisites + credits) with **auto-mapped requirements** — the user does not hand-build a checklist.
- Each credit has **credit-specific guidance** (what documentation earns the point) attached.
- A single product/material can **contribute to multiple credits** simultaneously (e.g., a product with both an EPD and an HPD feeds BPDO credits) — so the model is many-to-many between products and credits, not one-to-one.

**What a credit's status looks like — the color scale (key insight)**
Green Badger encodes credit status as a **single color that combines "state" and "points earned"**:
| Color | Meaning |
|-------|---------|
| **Red** | Not started — no entries yet contributing to the credit |
| **Yellow** | In progress — entries made, but threshold for any point not yet met |
| **Dark green** | Threshold met — currently earning **1 point** |
| **Bright green** | Earning **2 points** |
| **Bright blue** | Earning **3 points** / **Exemplary Performance** |

- Progress is **threshold-driven and data-derived**: status is computed from underlying entries (products logged, waste tickets, calculator inputs) crossing LEED point thresholds — not a manual "% complete" slider. This is a meaningful design choice: **the credit's status is a function of the data, not a self-reported percentage.**
- **Inspection-type credits** (IAQ, ESC) have no numeric threshold, so they display a **count of inspections completed** instead of a point color.

**Responsible party / due dates — UNCERTAIN.** Team members can be invited with roles and a **point person can be designated** for inspection tasks, and all activity is logged per person. However, no first-party source confirmed a per-credit **"assigned responsible party" field** or **per-credit due dates**. Green Badger appears more **data/threshold-centric** than **task/assignment-centric** (contrast with a Procore-style task manager). Flag this as a gap to verify in a demo — and a potential differentiation opportunity for us.

**Attachments.** Documentation/evidence (photos, signatures, approvals, PDFs, calculator outputs, product logs, SDS sheets, waste-ticket photos) attach to credits/entries and roll up into the export package. Accepted inputs include barcode scans, PDFs, Excel, CSV, and manual entry.

---

## 4. Workflow: field capture → aggregation → submission

**Field / subcontractor data capture**
- **Mobile-first capture** (iOS/Android app "Green Badger LEED Automation"): barcode scan of products, in-field IAQ and ESC inspections, photos, signatures, approvals, waste-ticket photos.
- **Subcontractor submission via simple links, no logins required** — a standout workflow choice. Subs submit product/material data through a link rather than being provisioned as platform users. Marketing claim: "Fewer RFIs. Fewer revise-and-resubmits."
- Product data captured once is verified against the database and shared to the whole team in real time (no emailing tracking logs).

**Aggregation**
- All entries are auto-logged (by person/date), auto-mapped to the relevant credit(s), and roll up into the **credit dashboard** and the built-in **LEED calculators** (BPDO, Low-Emitting Materials, C&D Waste).
- Owners/consultants get **real-time dashboards** rather than periodic status reports.

**Submission**
- Green Badger does **not** replace **LEED Online/GBCI** (the official certification system). Instead it produces **review-ready export documentation** that the team uploads to LEED Online for GBCI review. It is the _preparation & tracking_ layer feeding the official submission.
- Green Badger also offers **professional services / LEED consulting** as a complement to the software.

---

## 5. Integrations, pricing, positioning

**Integrations**
- **Procore** — an **Embedded App** in the Procore App Marketplace; manage LEED compliance inside the Procore project screen (dashboards, product verification, export) without switching tools. (Announced 2020; Tommy Linstroth + Procore quotes on record.)
- **Autodesk** — BIM 360 / Autodesk Construction Cloud.
- **EC3 (Building Transparency)** — import EPDs / embodied-carbon data.
- **HPD Collaborative** — health product declarations.
- **SSO** for enterprise access.
- **API** exists but is not publicly documented (contact vendor).

**Pricing (public but inconsistent across sources — verify directly)**
- getgreenbadger.com pricing page (via snippet): **Essential $250/mo · Team $350/mo · Professional $600/mo**, with **per-project licensing** (project activation requires a paid license; proposal-based).
- DataDrivenAEC: Pro **$250/mo annual / $300/mo monthly**; Enterprise/Team **$350–400/mo**; free trial.
- ITQlick: **$49/user/month**, plus **implementation $1,000–$5,000**, scaling to ~$4,000/mo at 100 users.
- **Interpretation:** the model appears to be **per-project subscription tiers** (feature/module gating by tier), not simple per-seat — hence the third-party per-user figures conflict. **Treat exact numbers as unconfirmed.**

**Positioning / target market**
- US/Canada construction; **GC-centric**, expanding to owners + architects; "every stage from first specification through owner turnover."
- Differentiators marketed: purpose-built for LEED (vs. generic PM tools), large verified product database, mobile field capture, loginless sub submission, Procore embedding, and now portfolio ESG/carbon.
- Competitive framing (from reviews): narrower than horizontal PM tools (Procore, Autodesk) but deeper on sustainability; broader than pure LCA/carbon tools.

---

## 6. UX patterns worth copying + weaknesses/complaints

**Patterns worth copying**
1. **Rating-system-driven checklist auto-generation** — pick BD+C/ID+C + version and the full credit/prereq list with mapped requirements is generated. Removes manual checklist building. (Directly applicable to our project-creation flow.)
2. **Per-credit version override dropdown** — global rating system, but credit-level version switching (models real LEED v4/v4.1 substitution behavior).
3. **Single color that fuses state + achievement** (red→yellow→dark green→bright green→bright blue). One glance conveys both "how far along" and "how many points." Consider adopting for our status field, though see the weakness below.
4. **Status derived from data, not self-reported %** — status changes when logged evidence crosses a threshold. Higher trust, less gaming, audit-friendly.
5. **Loginless subcontractor submission via links** — removes the biggest field-adoption barrier (provisioning sub accounts). Strong idea for our field workflow.
6. **Mobile barcode → instant compliance/VOC/SDS lookup** against a product DB, auto-logged to the project.
7. **Photo-of-the-ticket waste capture** and **in-field inspections** (IAQ/ESC) — minimal-friction capture at point of activity.
8. **Radial "speedometer" gauges** for ESG/portfolio metrics — instantly legible progress vs. goal.
9. **Digital "LEED consultant" per-credit guidance** embedded at the point of work.
10. **Audit trail by person/date** baked in, feeding audit-ready exports.
11. **Many-to-many product↔credit model** — one material feeds multiple credits.

**Weaknesses / complaints (from reviews — G2/Capterra/ITQlick/SourceForge/DataDrivenAEC)**
- **Narrow to LEED** — less useful for teams not pursuing LEED; some competitors offer broader sustainability/reporting scope. (Being addressed via ESG pivot.)
- **Integrations more limited** than horizontal competitors; **API undocumented**.
- **Setup requires vendor support**; possible learning curve on newer AI/ESG features; implementation cost cited ($1k–$5k).
- **Transparency gaps** (DataDrivenAEC): unpublished accuracy metrics for automated verification, unspecified data-retention, no formal security certifications listed.
- **Occasional downtime** noted.
- **Likely (not confirmed) gap: no explicit per-credit responsible-party assignment or due dates** — the tool is data/threshold-centric, weaker on task/assignment/deadline management. **This is our clearest differentiation opening.**
- **Color scale ambiguity risk:** because one color encodes both progress and point count, "yellow = in progress but zero points" can hide _how close_ a credit is, and colorblind accessibility is a concern. We can improve with explicit state + separate point/percent + accessible encoding.

---

## Sources

- Green Badger site (via search snippets; site blocks direct fetch): homepage, LEED Documentation Automation Platform, /solutions/features-and-functionality/automate/, /pricing/, /construction-esg-platform/, /esg/, /metric-carbon/, /metric-waste/, /contractors-commitment/, /faq_category/basics/, use-case pages (general-contractors, architect, owners, sustainability-professionals), /leed-sourcing-of-raw-materials/, /iaq-cheat-sheet/, /leed-indoor-air-quality-inspection-checklist/ — https://getgreenbadger.com/
- Apple App Store — "Green Badger LEED Automation": https://apps.apple.com/us/app/green-badger-leed-automation/id1597736006
- DataDrivenAEC review: https://datadrivenaec.com/tools/green-badger
- SoftwareFinder: https://softwarefinder.com/construction/green-badger
- ITQlick review: https://www.itqlick.com/green-badger
- PRNewswire — Procore integration announcement: https://www.prnewswire.com/news-releases/green-badger-leed-documentation-software-announces-integration-with-procore-301019340.html
- Civil+Structural Engineer — Procore integration: https://csengineermag.com/green-badger-leed-documentation-software-announces-integration-with-procore/
- Architosh (Jan 2026) — "Green Badger's New Leap: Rewiring Sustainability Data for the AEC": https://architosh.com/2026/01/green-badgers-new-leap-rewiring-sustainability-data-for-the-aec/
- ForConstructionPros — 2024 Sustainability Report & mobile app blog: https://www.forconstructionpros.com/
- CCR-Mag, BuiltWorlds, SourceForge, Capterra (India), Krowdbase listings (secondary).

## Confidence & gaps

**High confidence:** overall purpose/positioning; module list (LEED, materials/EPD/HPD, waste, IAQ/ESC, ESG/carbon, reporting); the **credit color-status scale** (red/yellow/dark-green/bright-green/bright-blue and their point meanings); project setup requiring rating-system-subtype selection + per-credit version dropdown; loginless subcontractor submission; barcode/mobile capture; Procore embedded app; EC3/HPD integrations; GC-centric market.

**Medium confidence:** exact scale claims (65% vs 80% documentation savings; "65% more credits") — vendor marketing, ranges vary. Named customer logos — marketing. ESG/carbon Scope 1/2/3 categorization detail.

**Low confidence / open gaps to verify in a live demo:**
- **Pricing** — three sources disagree (per-project tiers $250–$600/mo vs $49/user vs implementation fees). Model appears per-project, but confirm.
- **Per-credit responsible-party assignment and due dates** — not confirmed present; likely absent or weak. Highest-value item to verify because it defines our differentiation.
- **"Baili" AI / LLM** — asserted by one third-party review, not corroborated by first-party or the Architosh feature. Unconfirmed.
- Whether "% complete" exists as an explicit field vs. only the threshold-color model (evidence points to threshold-color only).
- First-party pages could not be fetched directly (403), so exact UI labels/field names are approximate — validate against a real account/demo before finalizing our data model.
