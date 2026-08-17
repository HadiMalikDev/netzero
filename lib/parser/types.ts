export type MetricType = "BOOLEAN" | "NUMERIC" | "DESCRIPTIVE";
export type PointsType = "fixed" | "scaled" | "shared";
// The submission stage label as declared by the document (e.g. "design",
// "construction", or "unknown" for single-stage manuals like O+E). Not a fixed
// union — stage vocabulary varies across the Mostadam family.
export type EvidenceStage = string;

export interface NumericLimit {
  name: string;
  op: string; // "<=" for max-concentration limits
  value: number;
  unit: string;
}

export interface NumericSpec {
  limits?: NumericLimit[];
  threshold?: { op: string; value: number; unit: string };
  summary?: string;
}

export interface EvidenceItem {
  stage: EvidenceStage;
  text: string;
}

/** Credit Applicability Conditions matrix: scope -> typology -> points | null. */
export type Applicability = Record<string, Record<string, number | null>>;

export interface ParsedRequirement {
  seq: number;
  title: string | null;
  text: string;
  pointsRaw: string | null;
  pointsType: PointsType;
  optionGroup: string | null; // XOR group label when the credit offers options
  keystone: boolean;
  keystoneCondition: string | null;
  metricType: MetricType;
  unit: string | null;
  numericSpec: NumericSpec | null;
  evidence: EvidenceItem[];
  pageStart: number;
  pageEnd: number;
}

/** Per-credit reconcile flag: does the extraction match the manual's own total? */
export interface CreditReconcile {
  ok: boolean;
  expected: number | null; // the credit's "Total N"
  got: number | null; // recomputed from requirements (option-aware)
  note: string;
}

export interface ParsedCredit {
  scheme: string;
  stage: string;
  code: string;
  categoryCode: string;
  categoryName: string;
  title: string;
  isKeystone: boolean;
  pointsRaw: string | null; // credit "Total N" from the manual
  aim: string | null;
  references: string[];
  creditTool: string | null;
  supportingGuidance: string | null;
  applicability: Applicability | null;
  reconciliation: CreditReconcile | null;
  pageStart: number;
  pageEnd: number;
  requirements: ParsedRequirement[];
}
