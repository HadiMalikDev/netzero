/**
 * The material credit parts the app calculates (D24, D28): each is one
 * percentage a Mostadam credit asks for, worked out from the products that
 * count toward it. Keys are stored on products and in the questionnaire's
 * default ticks, so they never change once shipped.
 *
 * Thresholds and wording are from the Mostadam Commercial D+C manual
 * (MW-04 p.219, MW-05 p.222, HC-11 p.183, RC-01 p.86).
 */
export type PartBasis = "weight" | "volume" | "cost" | "count";

export interface CreditPart {
  key: string;
  creditCode: string;
  label: string;
  basis: PartBasis;
  /** The share needed, in %. RC-01 has two (1 point at 20 %, 2 at 40 %). */
  thresholds: number[];
  /** Interior products only (inside the weatherproofing line). */
  interiorOnly: boolean;
  /** The manual's requirement, shortened. */
  rule: string;
  /**
   * The requirements (by seq within the credit) "Use this value" fills: a
   * number requirement gets the percentage, a yes/no one gets whether it is
   * met. RC-01 has one yes/no requirement per threshold, in the same order.
   */
  requirementSeqs: number[];
}

export const CREDIT_PARTS: CreditPart[] = [
  {
    key: "MW-05:steel",
    creditCode: "MW-05",
    label: "Recycled steel",
    basis: "weight",
    thresholds: [50],
    interiorOnly: false,
    rule: "At least 50% of reinforcing or stressing steel, by weight, has at least 80% recycled content.",
    requirementSeqs: [1],
  },
  {
    key: "MW-05:aggregates",
    creditCode: "MW-05",
    label: "Recycled aggregates",
    basis: "volume",
    thresholds: [15],
    interiorOnly: false,
    rule: "At least 15% of aggregates used on site, by volume, are recycled.",
    requirementSeqs: [2],
  },
  {
    key: "MW-05:timber",
    creditCode: "MW-05",
    label: "Certified timber",
    basis: "cost",
    thresholds: [50],
    interiorOnly: false,
    rule: "At least 50% of timber and composite wood products, by cost, have Chain of Custody certification.",
    requirementSeqs: [3],
  },
  {
    key: "HC-11:voc",
    creditCode: "HC-11",
    label: "Low-VOC adhesives, sealants, paints and coatings",
    basis: "weight",
    thresholds: [95],
    interiorOnly: true,
    rule: "At least 95% by weight of interior adhesives, sealants, paints and coatings are within the VOC limits.",
    requirementSeqs: [1],
  },
  {
    key: "HC-11:formaldehyde",
    creditCode: "HC-11",
    label: "Formaldehyde: composite wood and ceilings",
    basis: "count",
    thresholds: [100],
    interiorOnly: true,
    rule: "Every internal composite wood product and suspended ceiling is within the formaldehyde limits.",
    requirementSeqs: [],
  },
  {
    key: "RC-01:ksa",
    creditCode: "RC-01",
    label: "Materials made in KSA",
    basis: "cost",
    thresholds: [20, 40],
    interiorOnly: false,
    rule: "At least 20% (1 point) or 40% (2 points) of construction material cost is extracted, manufactured or assembled in KSA.",
    requirementSeqs: [1, 2],
  },
  {
    key: "MW-04:insulation",
    creditCode: "MW-04",
    label: "Non-polluting insulation",
    basis: "count",
    thresholds: [100],
    interiorOnly: false,
    rule: "Every thermal and acoustic insulation product meets the CFC/HCFC, ODP, GWP, formaldehyde and toxicity requirements.",
    requirementSeqs: [1],
  },
];

export const PART_KEYS = new Set(CREDIT_PARTS.map((p) => p.key));

export function partByKey(key: string): CreditPart | undefined {
  return CREDIT_PARTS.find((p) => p.key === key);
}

/** The calculated credit codes, for the credit page's material section. */
export const CALCULATED_CODES = new Set(CREDIT_PARTS.map((p) => p.creditCode));
