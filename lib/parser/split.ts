import { categoryName, KNOWN_PREFIXES } from "./mostadam";
import { cleanText } from "./text";
import type {
  MetricType,
  NumericLimit,
  ParsedCredit,
  ParsedRequirement,
} from "./types";

/**
 * Deterministic splitter for a Mostadam manual. It NEVER invents a credit: a
 * section only exists where a real credit-code header is followed by the fixed
 * Mostadam layout (Credit Requirements / Aim). Everything it emits carries a
 * source page span for citations. Metric-type is a heuristic here; the AI-shape
 * step may refine it, but is forbidden from adding requirements/points/limits.
 */

interface Line {
  page: number;
  text: string;
}

interface Section {
  code: string;
  prefix: string;
  title: string;
  start: number; // index into lines[]
  end: number; // exclusive
  pageStart: number;
  pageEnd: number;
}

const HEADER_RE = new RegExp(
  `^(${KNOWN_PREFIXES.join("|")})-(\\d{1,2})\\s+(.{2,80})$`,
);
const UNIT_RE =
  /(micrograms?\s+per\s+m3|µg\/m3|mg\/m3|ppm|ppb|dB\(A\)?[A-Za-z]*|kWh\/m2|kWh|liters?\/|litres?\/|%|m3|m²|m2|lux|W\/m2)/i;

function flatten(pages: string[]): Line[] {
  const lines: Line[] = [];
  pages.forEach((pageText, i) => {
    for (const raw of pageText.split("\n")) {
      lines.push({ page: i + 1, text: raw.trim() });
    }
  });
  return lines;
}

/** A header is real only if the fixed layout follows within a few lines. */
function isRealCreditStart(lines: Line[], i: number): RegExpMatchArray | null {
  const m = lines[i].text.match(HEADER_RE);
  if (!m) return null;
  if (/^Table/i.test(lines[i].text)) return null;
  // Look ahead for the Mostadam credit sub-header / Aim.
  for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
    const t = lines[j].text;
    if (/^Credit\s+Requirements/i.test(t) || /^Aim$/i.test(t)) return m;
  }
  return null;
}

function findSections(lines: Line[]): Section[] {
  const starts: { i: number; m: RegExpMatchArray }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = isRealCreditStart(lines, i);
    if (m) starts.push({ i, m });
  }
  const sections: Section[] = [];
  for (let s = 0; s < starts.length; s++) {
    const { i, m } = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].i : lines.length;
    sections.push({
      code: `${m[1]}-${m[2]}`,
      prefix: m[1],
      title: m[3].trim(),
      start: i,
      end,
      pageStart: lines[i].page,
      pageEnd: lines[end - 1]?.page ?? lines[i].page,
    });
  }
  return sections;
}

/** Index of the first line (from `from`) whose text matches `re`, else -1. */
function findLine(lines: Line[], from: number, to: number, re: RegExp): number {
  for (let i = from; i < to; i++) if (re.test(lines[i].text)) return i;
  return -1;
}

function guessMetricType(text: string, hasLimits: boolean): MetricType {
  if (hasLimits || /(must not exceed|maximum concentration|≥|≤|at least \d|minimum of \d)/i.test(text))
    return "NUMERIC";
  if (/(develop and implement|provide|submit|prepare|demonstrate|conduct|undertake|plan|report|assessment)/i.test(text))
    return "DESCRIPTIVE";
  return "BOOLEAN";
}

// Matches "<value> <unit>" where the value sits immediately before a
// concentration unit — so a digit-bearing name like "PM2.5" is not mistaken for
// the value.
const CONC_RE =
  /(\d+(?:\.\d+)?)\s+(micrograms?\s+per\s+m3|µg\/m3|mg\/m3|ppm|ppb)/i;

/** Parse "Table XX.N ..." limit rows within a section into numeric limits. */
function parseLimits(lines: Line[], from: number, to: number): NumericLimit[] {
  const limits: NumericLimit[] = [];
  const tableIdx = findLine(
    lines,
    from,
    to,
    /^Table\s+[A-Z]{1,3}-\d+\.\d+.*(concentration|contaminant|limit)/i,
  );
  if (tableIdx < 0) return limits;
  let pendingName = "";
  for (let i = tableIdx + 1; i < Math.min(tableIdx + 30, to); i++) {
    const t = lines[i].text;
    if (!t) continue;
    if (
      i > tableIdx + 1 &&
      /^(Supporting Guidance|Credit Tool|Reference Documents|Table\s+[A-Z]|b\)|c\)|d\))/i.test(t)
    )
      break;
    const m = t.match(CONC_RE);
    if (m) {
      const value = Number(m[1]);
      const namePart = t.slice(0, m.index).trim();
      const name = `${pendingName} ${namePart}`.trim().replace(/\s+/g, " ");
      const unit = m[2].replace(/\s+/g, " ");
      if (name) limits.push({ name, op: "<=", value, unit });
      pendingName = "";
    } else if (!/(Contaminant|Maximum|Concentration|^Limit$)/i.test(t)) {
      // Wrapped name line (e.g. "Total Volatile Organic") — prefix next row.
      pendingName = t;
    }
  }
  return limits;
}

const BULLET_RE = /^[•o▪○·\-]\s+/;

/**
 * Collect evidence bullets grouped by requirement seq. Scans only the Evidence
 * block(s) of the section and joins wrapped continuation lines back onto their
 * bullet.
 */
function parseEvidenceBySeq(
  lines: Line[],
  from: number,
  to: number,
  seqCount: number,
): Map<number, string[]> {
  const byReq = new Map<number, string[]>();
  const evStart = findLine(lines, from, to, /Stage\s+Evidence$/i);
  if (evStart < 0) return byReq;

  let current = 0;
  let buf: string[] | null = null; // current bullet's lines
  const push = () => {
    if (buf && current) {
      const clean = cleanText(buf.join(" "));
      if (clean) {
        const arr = byReq.get(current) ?? [];
        arr.push(clean);
        byReq.set(current, arr);
      }
    }
    buf = null;
  };

  for (let i = evStart + 1; i < to; i++) {
    const t = lines[i].text;
    if (/^(Supporting Guidance|Credit Tool|Reference Documents)/i.test(t)) {
      push();
      break;
    }
    if (!t) continue;
    if (/Stage\s+Evidence$/i.test(t) || /^#\s*Evidence/i.test(t)) continue;
    const seqM = t.match(/^(\d{1,2})$/);
    if (seqM && Number(seqM[1]) >= 1 && Number(seqM[1]) <= seqCount) {
      push();
      current = Number(seqM[1]);
      continue;
    }
    if (BULLET_RE.test(t)) {
      push();
      buf = [t.replace(BULLET_RE, "").trim()];
    } else if (buf) {
      buf.push(t); // wrapped continuation of the current bullet
    }
  }
  push();
  return byReq;
}

const TITLE_STOPWORDS = new Set([
  "and", "or", "the", "to", "of", "a", "an", "with", "for", "in", "on",
  "that", "which", "as", "is", "are", "by", "at", "from", "including",
]);

/**
 * If the requirement's first line looks like a short title (not a wrapped body
 * sentence), return it; else null. Conservative to avoid mislabeling body prose.
 */
function extractTitle(textLines: string[]): string | null {
  if (textLines.length < 2) return null;
  const first = textLines[0].trim().replace(/[:：]\s*$/, "");
  const words = first.split(/\s+/);
  const last = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "");
  const nextStartsSentence = /^[A-Z(]/.test(textLines[1].trim());
  if (
    words.length >= 2 &&
    words.length <= 8 &&
    first.length <= 60 &&
    !/[.,;]$/.test(first) &&
    !TITLE_STOPWORDS.has(last) &&
    nextStartsSentence
  ) {
    return cleanText(first);
  }
  return null;
}

/** Parse the "# Requirement Points Available ... Total N" table. */
function parseRequirements(
  lines: Line[],
  section: Section,
): { requirements: ParsedRequirement[]; totalPoints: string | null } {
  const { start, end } = section;
  const reqHdr = findLine(lines, start, end, /^Requirements$/i);
  const totalIdx = findLine(lines, reqHdr < 0 ? start : reqHdr, end, /^Total\s+\d+/i);
  const totalPoints =
    totalIdx >= 0 ? (lines[totalIdx].text.match(/Total\s+(\d+)/i)?.[1] ?? null) : null;

  const requirements: ParsedRequirement[] = [];
  if (reqHdr < 0) return { requirements, totalPoints };

  // The table body starts after the "# Requirement Points Available" header row.
  let bodyStart = reqHdr + 1;
  const colHdr = findLine(lines, reqHdr, Math.min(reqHdr + 4, end), /Points\s+Available/i);
  if (colHdr >= 0) bodyStart = colHdr + 1;
  const bodyEnd = totalIdx >= 0 ? totalIdx : end;

  // Walk sequential seq markers (1,2,3,...). Between markers: text + a trailing
  // standalone integer = points.
  let expected = 1;
  let cur: { seq: number; page: number; buf: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    // Last standalone-integer line in buf is the points.
    let points: string | null = null;
    const textLines: string[] = [];
    for (const b of cur.buf) {
      if (/^\d{1,2}$/.test(b) && points === null && cur.buf.indexOf(b) === cur.buf.length - 1) {
        points = b;
      } else {
        textLines.push(b);
      }
    }
    // Fallback: if trailing wasn't integer, scan from the end.
    if (points === null) {
      for (let k = cur.buf.length - 1; k >= 0; k--) {
        if (/^\d{1,2}$/.test(cur.buf[k])) {
          points = cur.buf[k];
          textLines.splice(k, 1);
          break;
        }
      }
    }
    // Split a short title line (e.g. "Indoor Air Quality (IAQ) Management Plan")
    // from the body, when the manual provides one. Conservative — the LLM label
    // fallback covers prose requirements that have no clean title line.
    const title = extractTitle(textLines);
    const text = cleanText(
      (title ? textLines.slice(1) : textLines).join(" "),
    );
    requirements.push({
      seq: cur.seq,
      title,
      text,
      pointsRaw: points,
      metricType: "DESCRIPTIVE",
      unit: null,
      numericSpec: null,
      evidenceSpecs: [],
      pageStart: cur.page,
      pageEnd: cur.page,
    });
    cur = null;
  };

  for (let i = bodyStart; i < bodyEnd; i++) {
    const t = lines[i].text;
    if (!t) continue;
    if (t === String(expected)) {
      flush();
      cur = { seq: expected, page: lines[i].page, buf: [] };
      expected++;
      continue;
    }
    if (cur) cur.buf.push(t);
  }
  flush();

  return { requirements, totalPoints };
}

export function splitCredits(
  pages: string[],
  scheme: string,
  stage: string,
): ParsedCredit[] {
  const lines = flatten(pages);
  const sections = findSections(lines);
  const credits: ParsedCredit[] = [];

  for (const section of sections) {
    const { start, end } = section;

    // Keystone + per-requirement points from the sub-header block.
    let isKeystone = false;
    for (let i = start; i < Math.min(start + 8, end); i++) {
      const m = lines[i].text.match(/Requirement\s*#\d+\s+(Yes|No)\s+\d+/i);
      if (m && /Yes/i.test(m[1])) isKeystone = true;
    }

    // Aim text.
    const aimIdx = findLine(lines, start, end, /^Aim$/i);
    const reqIdx = findLine(lines, start, end, /^Requirements$/i);
    let aim: string | null = null;
    if (aimIdx >= 0 && reqIdx > aimIdx) {
      aim = cleanText(
        lines
          .slice(aimIdx + 1, reqIdx)
          .map((l) => l.text)
          .filter(Boolean)
          .join(" "),
      );
    }

    const { requirements, totalPoints } = parseRequirements(lines, section);

    // Evidence per requirement (Design + Construction stage blocks).
    const evByReq = parseEvidenceBySeq(lines, start, end, requirements.length || 9);
    for (const r of requirements) {
      r.evidenceSpecs = evByReq.get(r.seq) ?? [];
    }

    // Numeric limits (attach to the requirement that references them, else the last).
    const limits = parseLimits(lines, start, end);
    if (limits.length && requirements.length) {
      const target =
        requirements.find((r) =>
          /(exceed|concentration|limit|testing|contaminant)/i.test(r.text),
        ) ?? requirements[requirements.length - 1];
      target.numericSpec = { limits };
      target.metricType = "NUMERIC";
      target.unit = limits[0].unit;
    }

    // Heuristic metric type for the rest.
    for (const r of requirements) {
      if (r.metricType === "NUMERIC") continue;
      r.metricType = guessMetricType(r.text, false);
    }

    // Credit Tool + references.
    const toolIdx = findLine(lines, start, end, /^Credit\s+Tool$/i);
    let creditTool: string | null = null;
    if (toolIdx >= 0 && toolIdx + 1 < end) creditTool = lines[toolIdx + 1].text || null;

    const refIdx = findLine(lines, start, end, /^Reference\s+Documents/i);
    const references: string[] = [];
    if (refIdx >= 0) {
      for (let i = refIdx + 1; i < end; i++) {
        const t = lines[i].text;
        if (/^\d+\.\s+/.test(t))
          references.push(cleanText(t.replace(/^\d+\.\s+/, "")));
      }
    }

    credits.push({
      scheme,
      stage,
      code: section.code,
      categoryCode: section.prefix,
      categoryName: categoryName(section.prefix),
      title: section.title,
      isKeystone,
      pointsRaw: totalPoints,
      aim,
      references,
      creditTool,
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      requirements,
    });
  }

  return credits;
}
