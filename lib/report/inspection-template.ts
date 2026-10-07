/**
 * Printable inspection-sheet templates: the numbered Yes/No forms a site team
 * fills and signs, as the contractor on the Jeddah Oceanarium already does
 * for HC-10. The Mostadam manual names only the control-measure headings; the
 * items under them are the client's own form (received 2026-10-07), plus a
 * Moisture & Mold Control section the manual requires and that form lacked.
 *
 * A template applies to a credit by what the credit is (its title), not by
 * its code: HC-10 is Indoor Air Quality in Commercial D+C, but the same credit
 * carries another code in other Mostadam schemes.
 *
 * The sheet is generated blank in the Yes / No / Remarks columns on purpose.
 * Those are a human's assertions about the site on a date; the app does not
 * hold them and must not guess them. What the app adds is the header, the
 * photographs already uploaded, and an advisory column saying whether the
 * uploaded plan addresses each item (lib/ai/plan-coverage.ts).
 */

export interface TemplateItem {
  /** "1.1", "2.3" … — the numbering the site team already uses. */
  no: string;
  text: string;
}

export interface TemplateSection {
  no: string;
  heading: string;
  items: TemplateItem[];
}

export interface InspectionTemplate {
  /** Stable id, also used in the download file name. */
  id: string;
  /** Printed title, e.g. "Construction Indoor Air Quality Inspection". */
  title: string;
  /** Which credit this sheet belongs to, by title. */
  matches: (credit: { title: string }) => boolean;
  /**
   * Which of the credit's required documents is the plan the items are read
   * against (for the advisory coverage column). Matched on the document text.
   */
  planDocument: RegExp;
  /**
   * The required document this sheet becomes once completed (e.g. "Completed
   * IAQ Checklist…"). The sheet takes its stage from that document's stage tag
   * in the catalog, not from where the project currently is: the form is used
   * during construction even while the project is still at design.
   */
  sheetDocument: RegExp;
  sections: TemplateSection[];
  /** The declaration above the signature line. */
  confirmation: string;
}

const section = (no: string, heading: string, texts: string[]): TemplateSection => ({
  no,
  heading,
  items: texts.map((text, i) => ({ no: `${no}.${i + 1}`, text })),
});

export const IAQ_INSPECTION: InspectionTemplate = {
  id: "iaq-inspection",
  title: "Construction Indoor Air Quality Inspection",
  matches: (c) => /indoor\s+air\s+quality/i.test(c.title),
  planDocument: /IAQ\s+Management\s+Plan/i,
  sheetDocument: /Completed\s+IAQ\s+Checklist/i,
  sections: [
    section("1", "HVAC Protection", [
      "Filters at supply air intake",
      "Filters at return air openings",
      "Seal supply diffusers and return air during demolition",
      "Seal supply diffusers and return air openings during construction",
      "Mechanical rooms clean and neat",
      "Periodic duct inspections during construction",
      "Contractor to document with photographs",
    ]),
    section("2", "Source Control", [
      "Low/no VOC products as indicated by specifications",
      "Restrict vehicle traffic volume and prohibit idling",
      "Cycle equipment off, when not being used or needed",
      "Exhaust pollution sources to the outside",
      "Keep containers of wet products closed",
      "Cover or seal containers of waste materials",
      "Protect absorptive building materials from weather and moisture",
      "Contractor to document with photographs",
    ]),
    section("3", "Pathway Interruption", [
      "Provide duct containers or temporary enclosures",
      "Locate pollutant sources as far as possible from supply ducts and areas occupied by workers",
      "Isolate areas of work to prevent contamination of clean or occupied areas",
      "When using VOC emitting materials ventilate using 100% outside air",
      "General contractor to document with photographs",
    ]),
    section("4", "Housekeeping", [
      "Provide regular cleaning, including HVAC equipment",
      "If necessary clean HVAC equipment prior testing, adjusting and balancing the system",
      "Suppress and minimize dust with wetting agents or sweeping compounds",
      "Remove accumulations of water inside the building",
      "Protect porous materials",
      "General contractor to document with photographs",
    ]),
    section("5", "Scheduling and Construction Activity Sequence", [
      "Scheduling pollution activities prior to installing absorbent materials",
      "Coordinate construction activities to minimize or eliminate disruption of operations in the occupied portions of the building",
    ]),
    // Required by Mostadam HC-10 in addition to SMACNA's five (manual p.181).
    section("6", "Moisture & Mold Control", [
      "Store absorptive materials off the floor, under cover and away from wet work",
      "Remove standing water and dry wetted areas promptly",
      "Replace absorptive materials that have been wet and show staining or mould",
      "Contractor to document with photographs",
    ]),
  ],
  confirmation:
    "I confirm the checked activities to be proceeding according to the construction Indoor Air Quality Management Plan. Items that are not checked will be addressed, initialled and dated once corrective actions have been taken. Items that are not applicable are labelled as such.",
};

export const INSPECTION_TEMPLATES: InspectionTemplate[] = [IAQ_INSPECTION];

/** The sheet that applies to a credit, if any. */
export function templateFor(credit: { title: string }): InspectionTemplate | null {
  return INSPECTION_TEMPLATES.find((t) => t.matches(credit)) ?? null;
}

export function templateItems(t: InspectionTemplate): TemplateItem[] {
  return t.sections.flatMap((s) => s.items);
}
