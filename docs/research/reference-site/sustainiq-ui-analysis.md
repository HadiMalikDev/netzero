# Reference App Teardown — "SustainIQ" (Figma prototype)

**Source:** https://stick-print-07895563.figma.site/ (a Figma Make clickable prototype)
**Captured:** 2026-08-16 via headless Chrome (Playwright). Screenshots in [`./screenshots/`](./screenshots/).
**Purpose:** This is the design reference the client shared. It is a *prototype* (mock data, no real backend), but it encodes the intended IA, data model, and flows very clearly. We treat it as the north-star UX for our own build, not as a spec to copy 1:1.

> Note: the prototype is branded "SustainIQ" and is US/LEED-first in its sample data. Our product is Saudi/Mostadam-first (see domain research). The *structure* transfers; the *content* (rating systems, credit catalogs, levels) must be localized.

---

## 1. Information Architecture (sidebar)

The app is a left-nav SaaS shell grouped into four sections:

| Group | Items |
|---|---|
| **MAIN** | Dashboard · Projects (5) · Credits · Task Board (9) · Documents |
| **INTELLIGENCE** | AI Assistant · Reports |
| **ORGANIZATION** | Users · Departments · Notifications (3) |
| **SYSTEM** | Settings |

Top bar: global search (⌘K), help, notifications, user menu. Persistent user card bottom-left (name + role, e.g. "Sustainability Manager").

**Screens captured:** login, dashboard, projects list, project detail, credits table, credit detail, task board, documents, AI assistant, reports, users, departments, notifications, settings, and the full 7-step "New Project" wizard.

---

## 2. Login (`screenshots/00-landing-*.png`)

Split screen. Left = brand/marketing panel ("Build Greener. Certify Smarter.", floating stat cards: "LEED Platinum · 82 pts", "Compliance Score 91%", "AI Insight: 3 credits need documentation", plus "500+ Projects Certified / 94% Success Rate / 42 Countries"). Right = sign-in form (email, password, remember me, forgot password, ToS/Privacy). Demo creds pre-filled.

**Takeaway:** conventional email/password auth; marketing panel sells the "AI insight + compliance score" value prop. Nothing exotic for us to build.

---

## 3. Dashboard (`screenshots/01-dashboard-full.png`)

Portfolio-level home. Elements:

- **Greeting** ("Good morning, Sarah") + attention banner ("9 overdue items need attention").
- **4 KPI tiles:** Active Projects (5, across 4 countries, +2 this quarter) · Credits Completed (253 of 513, +18 this week) · Open Tasks (341, 47 assigned to you, 9 overdue) · Pending Reviews (12, documents awaiting approval).
- **Portfolio Certification Score** — line chart over 8 months, with Platinum threshold / current score / projected score callouts and an "On Track" pill.
- **Credits by Status** — donut (Completed / In Progress / Under Review / Not Started) with counts.
- **Active Projects** list — per-project progress bar, points, target level.
- **AI Recommendation** card — e.g. "Prioritize EPD collection for Materials & Resources credits. 5 suppliers outstanding. Certification probability drops 12% after May 30."

**Takeaway:** The dashboard is an *aggregation/rollup* view — exactly the surface where our "aggregator AI" narrates status. Most tiles are pure counts/derived metrics off the credit + task tables.

---

## 4. Projects (`screenshots/nav-projects-full.png`)

Card grid (grid/list toggle), search + filter, **"+ New Project"** button. Each card shows:

- Rating-system badge + project type (e.g. **LEED** · Commercial Office; **MOSTADAM** · Mixed-Use Development; **WELL** · Residential; **BREEAM** · Retail; **EDGE** · Healthcare)
- Project name, location, status pill (In Progress / Review / Planning / Completed)
- Overall progress % bar
- Done / Active / Open counts
- Owner avatar + target date

**Takeaway:** A project is scoped to **one or more rating systems** and a project type. Progress = derived from credit statuses. This is the primary list our MVP must nail.

---

## 5. New Project wizard (`screenshots/create-0*.png`) ⭐ MVP-critical

A 7-step modal wizard:

1. **General Info** — name, type, location, area, dates (project basics).
2. **Certification** — "Select one or more certification systems": **LEED · Mostadam · EDGE · WELL · BREEAM** (multi-select).
3. **Buildings** — "Add Building" (a project can contain multiple buildings).
4. **Departments** — pick responsible disciplines: **Architecture, MEP, Landscape, Structural, Interior, Waste Management, Electrical, Mechanical** (multi-select).
5. **Team** — add/remove members (assign people).
6. **Milestones** — project timeline milestones (Design → Tender → Construction → Commissioning → Submission style).
7. **Review** — confirm & create.

**Takeaway:** This is the clearest signal of the intended project-creation model. Note: the prototype does **not** show a "upload spec document → auto-derive credits" step — it assumes credits come from picking a known rating system. **The client's ask adds a document-ingestion path** (upload HC-10-style spec → parse into checklist). That is a net-new capability vs. this reference and is a key scope question (see open questions). Two viable models:
- (a) **Catalog-driven:** pick rating system → app loads its pre-built credit catalog (what SustainIQ implies).
- (b) **Document-driven:** upload a spec doc → parse credits/metrics into a checklist (client's stated need).
- Likely we need **both**, with (a) as the reliable backbone and (b) as an import/assist path.

---

## 6. Credits table (`screenshots/nav-credits-full.png`) ⭐ MVP-critical

Scoped to a project + rating system version (breadcrumb: "Greenfield Tower Phase II · LEED BD+C v4"). Summary tiles: Total Points (82 of 110) · Completed (67) · In Progress (28) · High Risk (5).

Filter chips: All / Completed / In Progress / Under Review / Not Started, plus search.

**Table columns:** Credit Name · Category · Points (earned/available, e.g. 16/18) · Status · Owner · Due Date · Compliance % · Risk (None/Low/Medium/High). Rows expand to the credit detail.

Categories seen (LEED): Sustainable Sites, Water Efficiency, Energy & Atmosphere, Materials & Resources, Indoor Environmental Quality, Innovation, Regional Priority.

**Takeaway:** This is the core tracking object. Each credit carries: category, point value/earned, status, owner, due date, compliance %, risk level.

---

## 7. Credit detail (`screenshots/credit-expanded-full.png`) ⭐⭐ Core data model

Header: category tag · status pill · risk pill · title · **Export** / **Mark Complete** actions.

**Tabs:** Overview · Tasks · Documents · Reviews · AI Analysis · Submission · History.

Overview tab:
- **Credit Description** — intent + requirements narrative (e.g. "…optimize energy performance by demonstrating an improvement over the ASHRAE 90.1-2016 baseline. Documentation must include a calibrated energy model, commissioning report, and utility rate analysis. Points awarded on a sliding scale…").
- **Requirements Checklist** — list of individual **checkable items** (booleans), some done (strikethrough + checked), some open: e.g. "Energy model using ASHRAE 90.1-2016 baseline" ✓, "Commissioning report from approved provider" ☐.
- **Credit Details** sidebar — Points Earned (16/18), Compliance %, Owner, Due Date, Missing Docs count.
- **Responsible Departments** — tags (MEP, Sustainability, Management).

**Takeaway — the data shape we must model:**
```
Project
 └─ CertificationTrack (rating system + version, e.g. Mostadam Residential v?)
     └─ Category (e.g. Health & Comfort / Energy)
         └─ Credit (id/code, intent, points available/earned, status, owner,
                    due date, risk, compliance%, responsible departments)
             ├─ ChecklistItem[]  (the requirement — see value types below)
             ├─ Document[]       (evidence/attachments)
             ├─ Task[]           (work to satisfy the credit)
             ├─ Review[]         (approvals)
             └─ HistoryEvent[]   (audit trail)
```
In the reference, checklist items are **boolean only**. The client explicitly wants checklist item values to also be **numeric-range** (e.g. "achieve ≥ X") and **free-text** — so our `ChecklistItem` needs a `valueType ∈ {boolean, number/range, text, ...}` field. This is the single most important modeling decision and it is broader than the reference.

---

## 8. Project detail (`screenshots/project-detail-full.png`)

Header: name, status, "LEED · Platinum" badge, location, **Export** / **Submit to GBCI** actions.
KPI tiles: Certification Score (82 pts, target 80 Platinum) · Credits Addressed (95 of 110) · Open Tasks (47, 9 overdue) · Project Area (42,500 m²).
Tabs: Overview · Credits · Tasks · Documents · Team · Risks.
Overview content: Credit Summary donut + Completed/In-Progress/Not-Started bars; **Project Timeline** (Design → Tender → Construction → Commissioning → Submission with dates); **Department Performance** bar chart; **AI Analysis** panel ("On track for LEED Platinum / 3 credits need immediate documentation / projected 94 pts"); Project Team; Project Info.

**Takeaway:** Per-project rollup mirrors the portfolio dashboard but scoped to one project. "Submit to GBCI" hints at an eventual submission/export-to-certifier step (for us: submit to Mostadam authority / consultant).

---

## 9. AI Assistant (`screenshots/nav-ai-assistant-full.png`) ⭐ MVP-critical (but scope it down)

Chat UI scoped to a project ("Analyzing Greenfield Tower Phase II", shows track + points in header).

**Quick Actions:** Predict certification score · Find missing documents · Detect compliance risks · Generate submission narrative · Suggest high-value credits · Analyze uploaded document.

Sample exchange: user asks "predict our final score if we complete all in-progress credits" → assistant returns a scenario table (Current 82 → All in-progress done 94 → incl. high-risk 98) with a "key insight" and a follow-up offer.

**Takeaway & scope note:** This reference AI is fairly *generative* (predictions, narrative writing). The client's Stage-1 ask is deliberately narrower: a **grounded aggregator / parser** — "what's remaining, what's left, what should I do next" — answered strictly from project data, **not inventing** requirements. So for MVP we implement a subset:
- ✅ Find missing documents (aggregation)
- ✅ Detect compliance risks / overdue (aggregation)
- ✅ "What's left / remaining" summaries (aggregation)
- ✅ Suggest highest-impact next credits (ranking over existing data)
- ⏸️ Generate submission narrative / free-form predictions → later phase (more generative, higher risk).
The MVP assistant should be an **AI search/aggregation agent over the project's own data** with citations back to the credit/task/document it references — never fabricating credits or requirements.

---

## 10. Other screens (briefly)

- **Task Board** (`nav-task-board`) — kanban of tasks (9 open badge). Tasks link to credits.
- **Documents** (`nav-documents`) — document library / evidence repository.
- **Reports** (`nav-reports`) — reporting/export surface.
- **Users / Departments** (`nav-users`, `nav-departments`) — org & RBAC setup; Departments matches the disciplines in the create wizard.
- **Notifications** (`nav-notifications`) — activity/alerts (overdue, reviews, docs).
- **Settings** (`nav-settings`) — workspace/system config.

---

## 11. Visual / design language

- Dark teal/green primary (`#0e6b5e`-ish), near-black sidebar, light neutral canvas, generous rounded cards, pill badges for status/risk, subtle shadows.
- Status color coding: green = complete/on-track, teal = in-progress, amber/yellow = review/medium risk, red = overdue/high risk, grey = not started.
- Clean, data-dense but breathable. Tailwind-friendly. This aligns with our stack (Next.js 16 + Tailwind 4).

---

## 12. What we adopt vs. what we change

**Adopt:** overall IA, project→credit→checklist hierarchy, credit detail tabs, status/risk taxonomy, dashboard rollups, the 7-step creation wizard, the AI-assistant surface.

**Change / add for our product:**
1. **Mostadam-first** content (rating systems, categories/codes like HC/EN/WA, levels, point thresholds) instead of LEED sample data.
2. **Document ingestion** path (upload HC-10-style spec → parse to checklist) — net-new vs. reference.
3. **Multi-type checklist values** (boolean **+ numeric/range + free-text**) — reference is boolean-only.
4. **Constrain the AI** to grounded aggregation for MVP (no invented content).
5. Arabic/RTL and KSA localization considerations (flag for later).

---

## Confidence & gaps
- IA, flows, and the create wizard steps are **directly observed** (high confidence).
- Some deep screens (Task Board, Documents, Reports internals) were captured but only skimmed here — full-res PNGs are in `screenshots/` if we need detail later.
- The reference has **no** document-upload-to-credit-derivation flow visible; the "Analyze uploaded document" quick action is the only hint. Treat doc-ingestion as our own design problem.
</content>
</invoke>
