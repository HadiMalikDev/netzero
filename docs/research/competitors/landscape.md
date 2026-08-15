# Adjacent Competitor / Ecosystem Landscape

_Compiled 2026-08-16 for the NetZero certification-compliance product. One-line orientation on the tools adjacent to Green Badger that we should be aware of. Green Badger itself is covered in `green-badger.md`._

## Where these tools sit

The ecosystem splits into a few lanes. Understanding the lane matters for our positioning:

- **Certification system-of-record (official):** LEED Online / Arc — where certification is actually registered, submitted, and scored by GBCI/USGBC. Not competitors; they are the endpoint our exports feed.
- **Construction-phase documentation & compliance tracking:** Green Badger (our reference), and to a degree Arc for operations. This is our lane.
- **Product / material sustainability data (EPDs, HPDs):** EC3, Ecomedes — the data sources our material capture depends on.
- **Life-cycle assessment / embodied carbon calculation:** One Click LCA, EC3, plus broader ESG/"sustainability cloud" platforms.

## The players (one line each)

| Tool | Lane | What it does |
|------|------|--------------|
| **LEED Online (USGBC / GBCI)** | Official system-of-record | The mandatory USGBC/GBCI platform where a LEED project is **registered, credits submitted, and reviewed/scored** (Certified/Silver/Gold/Platinum). It is the certification endpoint — Green Badger and tools like ours prepare and export documentation _into_ it; it is not a tracking/collaboration tool. |
| **Arc Skoru (Arc)** | Performance / operations | GBCI+USGBC **performance platform** that measures **operational** building/portfolio performance — energy, water, waste, transportation, human experience — into a live Arc score. Also a registration path alongside LEED Online. Focus is **operating buildings**, not construction-phase documentation or embodied carbon. |
| **Building Transparency EC3** | Material data / embodied carbon | **Free** Embodied Carbon in Construction Calculator. Pairs a large **third-party EPD database** with building **material quantities** (from BIM/estimates/as-builts) to benchmark and reduce **embodied carbon** during design & procurement. Green Badger integrates with it; often used for the LEED embodied-carbon/BPDO story. |
| **Ecomedes** | Product / material data | Cloud platform for **discovering and evaluating sustainable building products** — the largest aggregated database of green certifications/EPDs/HPDs across the widest product range. Serves manufacturers (publish/manage product sustainability data) and specifiers/contractors (find compliant products for LEED, WELL, mindful MATERIALS). A data source, not a project-tracking tool. |
| **One Click LCA** | LCA / embodied carbon | Global **life-cycle assessment** software; measures & reduces embodied (and whole-life) carbon from pre-design to completion. 300k+ verified LCA datapoints, 170+ countries; integrated with EC3; supports LEED v5 LCA. Deeper/broader LCA engine than EC3's calculator; used by specialists. |
| **"Sustainability Cloud" ESG platforms** | Corporate ESG / carbon accounting | Enterprise ESG & carbon-accounting suites (e.g., Salesforce Net Zero Cloud, Watershed, Persefoni, Sphera, Cority, and similar). They handle **corporate-level Scope 1/2/3 carbon accounting and ESG disclosure/reporting** across an organization — broader than any single project's green-building certification. Green Badger's ESG module competes at the edges (portfolio ESG for contractors) but these are enterprise-wide reporting tools. |

## Implications for us

- **LEED Online / Arc are not to be rebuilt** — they are the official endpoints; our value is the tracking/collaboration/documentation layer that produces clean submissions for them (same wedge Green Badger occupies).
- **EC3 / Ecomedes / One Click LCA are integration targets, not head-to-head competitors** — they supply product/EPD/LCA data. Green Badger wins partly by embedding these data sources; we should plan for the same integrations rather than reinventing product databases.
- **Enterprise ESG clouds are up-market and adjacent** — a risk only if we chase corporate carbon accounting. For a construction-project certification-compliance MVP, they are out of lane.
- **Direct competitive set for our MVP** is narrow: Green Badger is the clearest US analog; horizontal PM tools (Procore/Autodesk) are where the data lives and where embedding/integration matters.

## Sources

- LEED Online / USGBC certification process: https://www.usgbc.org/leed · https://www.leedonline.com/ · https://support.usgbc.org/hc/en-us/articles/4404407074323-LEED-certification-process-overview
- Arc Skoru: https://arc.gbci.org/ · https://arc.gbci.org/about · https://support.usgbc.org/hc/en-us/articles/4423532407571-About-Arc
- Building Transparency EC3: https://www.buildingtransparency.org/ · https://www.buildingtransparency.org/tools/ec3/ · https://carbonleadershipforum.org/ec3-tool/
- Ecomedes: https://www.ecomedes.com/products · https://www.ecomedes.com/enterprise-solutions-for-manufacturers
- One Click LCA: https://oneclicklca.com/ · https://oneclicklca.com/software/design-construction/carbon-calculator · https://help.oneclicklca.com/en/articles/449516
- Sustainability/ESG clouds (category reference): vendor sites for Salesforce Net Zero Cloud, Watershed, Persefoni, Sphera, Cority.

## Confidence & gaps

**High confidence:** the lane each tool occupies and the core one-line function — LEED Online = official submission/scoring; Arc = operational performance; EC3 = free embodied-carbon calculator + EPD DB; Ecomedes = sustainable-product data aggregator; One Click LCA = LCA engine. These are well-established and cross-verified.

**Medium/low confidence:** the "Sustainability Cloud" row is a **category summary** — I named representative enterprise ESG vendors rather than confirming a single product the user meant by "Sustainability Cloud tools"; if a specific product (e.g., Salesforce Net Zero Cloud) was intended, confirm. Exact feature boundaries between EC3 and One Click LCA blur where they integrate; pricing/tiers for each were not researched here (out of scope for one-line landscape).
