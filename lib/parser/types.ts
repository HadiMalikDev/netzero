export type MetricType = "BOOLEAN" | "NUMERIC" | "DESCRIPTIVE";

export interface NumericLimit {
  name: string;
  op: string; // "<=" for max-concentration limits
  value: number;
  unit: string;
}

export interface NumericSpec {
  limits?: NumericLimit[];
  threshold?: { op: string; value: number; unit: string };
}

export interface ParsedRequirement {
  seq: number;
  title: string | null;
  text: string;
  pointsRaw: string | null;
  metricType: MetricType;
  unit: string | null;
  numericSpec: NumericSpec | null;
  evidenceSpecs: string[];
  pageStart: number;
  pageEnd: number;
}

export interface ParsedCredit {
  scheme: string;
  stage: string;
  code: string;
  categoryCode: string;
  categoryName: string;
  title: string;
  isKeystone: boolean;
  pointsRaw: string | null; // e.g. "3"
  aim: string | null;
  references: string[];
  creditTool: string | null;
  pageStart: number;
  pageEnd: number;
  requirements: ParsedRequirement[];
}
