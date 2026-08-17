import { categoryName } from "./mostadam";
import { cleanText } from "./text";
import type {
  Applicability,
  EvidenceItem,
  EvidenceStage,
  MetricType,
  BandSet,
  NumericLimit,
  ParsedCredit,
  ParsedRequirement,
  ScoreBand,
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

// Any credit-code header; the following-layout check (isRealCreditStart) is what
// makes it real, so we do NOT restrict to a fixed set of category prefixes —
// prefixes differ across Mostadam schemes (Residential/Commercial/Communities).
const HEADER_RE = /^([A-Z]{1,3})-(\d{1,2})\s+(.{2,80})$/;

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

const POINTS_TABLE_HDR = /^Table\s+[A-Z]{1,3}[.\-]\d+/i;
const POINTS_PAIR = /^(\d{1,2})\s+(\d+(?:\.\d+)?)%$/;
const POINTS_PAIR_G = /(\d{1,2})\s+(\d+(?:\.\d+)?)%/g;
const POINTS_COL_HDR = /^(Points\s+[Aa]chieved|Percentage|improvement|reduction)$/i;
const POINTS_PAGE_NUM = /^\d{1,3}$/;
const POINTS_TABLE_STOP =
  /^(b\)|c\)|d\)|Credit\s+Tool|Reference\s+Documents|Table\s+|Additional Clarifications|Renewable Energy|Simulation Software|For warehouses)/i;

function pointsTableLabel(header: string): string | null {
  const m = header.match(/points\s+achieved(?:\s+for)?\s+(.+)/i);
  const raw = m?.[1]?.trim();
  if (!raw || /^percentage/i.test(raw)) return null;
  return raw.replace(/\s+/g, " ");
}

/**
 * Parse "Table X.N Points achieved … / Percentage improvement" band tables
 * from Supporting Guidance. Layout-based — no credit-code hardcoding.
 */
function parsePointsTables(
  lines: Line[],
  from: number,
  to: number,
): BandSet[] {
  const sets: BandSet[] = [];
  for (let i = from; i < to; i++) {
    const t = lines[i].text;
    if (!POINTS_TABLE_HDR.test(t)) continue;
    const window = [t, lines[i + 1]?.text ?? "", lines[i + 2]?.text ?? ""].join(
      " ",
    );
    if (!/points\s+achieved/i.test(window) || !/percent/i.test(window)) continue;

    const bands: ScoreBand[] = [];
    let j = i + 1;
    while (j < to) {
      const row = lines[j].text;
      if (!row || POINTS_PAGE_NUM.test(row) || POINTS_COL_HDR.test(row)) {
        j++;
        continue;
      }
      const sole = row.match(POINTS_PAIR);
      if (sole) {
        bands.push({ points: Number(sole[1]), min: Number(sole[2]) });
        j++;
        continue;
      }
      const pairs = [...row.matchAll(POINTS_PAIR_G)];
      if (pairs.length >= 2) {
        for (const p of pairs)
          bands.push({ points: Number(p[1]), min: Number(p[2]) });
        j++;
        continue;
      }
      if (bands.length > 0 && (POINTS_TABLE_STOP.test(row) || POINTS_TABLE_HDR.test(row)))
        break;
      if (bands.length > 0) break;
      j++;
      if (j > i + 8) break;
    }
    if (bands.length >= 2) {
      sets.push({ label: pointsTableLabel(t), bands });
      i = j - 1;
    }
  }
  return sets;
}

// Include U+F0B7 (Symbol-font bullet) and friends some credits use.
const BULLET_RE = /^(?:[•▪●○·]\s*|[o-]\s+)/;

// Evidence region begins at a "<X> Stage Evidence" header (D+C: Design /
// Construction) OR a plain "Evidence" / "# Evidence per Requirement" header
// (O+E and others use a single, unstaged block). Detect the label; don't assume.
const STAGE_HDR_RE = /^([A-Za-z][A-Za-z ]*?)\s+Stage\s+Evidence$/;
const EVIDENCE_START_RE = /(Stage\s+Evidence$|^#?\s*Evidence(\s+per\s+Requirement)?$)/i;

/**
 * Collect evidence per requirement, tagged with whatever submission stage the
 * document declares (design/construction in D+C, a single stage in O+E). Stages
 * are separately reviewed/certified, so they must not be merged (audit B2).
 * Wrapped continuation lines are joined; leaked page numbers are ignored.
 */
function parseEvidenceByStage(
  lines: Line[],
  from: number,
  to: number,
  seqCount: number,
): Map<number, EvidenceItem[]> {
  const byReq = new Map<number, EvidenceItem[]>();
  const evStart = findLine(lines, from, to, EVIDENCE_START_RE);
  if (evStart < 0) return byReq;

  let stage: EvidenceStage = "unknown";
  // One or more seqs the next bullets belong to. Shared labels ("1 & 2")
  // attach the same evidence to every listed requirement.
  let currents: number[] = [];
  let pendingAnd: number[] | null = null;
  let buf: string[] | null = null;
  // Option credits (e.g. E-01) list evidence per option, each with its own
  // "# Evidence per Requirement" restarting at 1. Requirements were renumbered
  // across options (1,2,…), so we offset the evidence seq by the requirements
  // consumed in earlier options of the SAME stage. `base` resets each stage.
  let base = 0;
  let maxSeqInBlock = 0;
  const inRange = (n: number) => n >= 1 && n <= seqCount;
  const setCurrents = (seqs: number[]) => {
    currents = seqs.filter(inRange).map((n) => base + n);
    for (const n of seqs) if (inRange(n)) maxSeqInBlock = Math.max(maxSeqInBlock, n);
  };
  const push = () => {
    if (buf && currents.length) {
      // Drop a trailing leaked page number ("… Energy Tool. 100").
      const text = cleanText(buf.join(" ").replace(/\s+\d{2,3}\s*$/, ""));
      if (text) {
        for (const seq of currents) {
          const arr = byReq.get(seq) ?? [];
          arr.push({ stage, text });
          byReq.set(seq, arr);
        }
      }
    }
    buf = null;
  };

  for (let i = evStart; i < to; i++) {
    const t = lines[i].text;
    if (/^(Supporting Guidance|Credit Tool|Reference Documents)/i.test(t)) {
      push();
      break;
    }
    if (!t) continue;
    const stageM = t.match(STAGE_HDR_RE);
    if (stageM) {
      push();
      stage = stageM[1].trim().toLowerCase(); // e.g. "design", "construction"
      base = 0;
      maxSeqInBlock = 0;
      continue;
    }
    // Option sub-header: advance the base past the previous option's rows so its
    // evidence maps to the right (renumbered) requirement, and consume the line
    // so "Option 2 – Performance Option" never leaks into evidence text.
    if (OPTION_HDR_RE.test(t)) {
      push();
      base += maxSeqInBlock;
      maxSeqInBlock = 0;
      continue;
    }
    if (/^#?\s*Evidence(\s+per\s+Requirement)?$/i.test(t)) continue;
    // A standalone integer bigger than the requirement count is a leaked page
    // number, not a requirement marker — skip it.
    if (/^\d+$/.test(t) && Number(t) > seqCount) continue;
    // Shared evidence: "1 & 2" (one line) or "1 &" then "2" (wrapped).
    const andAll = t.match(/^(\d{1,2}(?:\s*&\s*\d{1,2})+)\s*$/);
    if (andAll && t.includes("&")) {
      push();
      pendingAnd = null;
      setCurrents([...t.matchAll(/\d{1,2}/g)].map((m) => Number(m[0])));
      continue;
    }
    const andOpen = t.match(/^(\d{1,2})\s*&\s*$/);
    if (andOpen && inRange(Number(andOpen[1]))) {
      push();
      pendingAnd = [Number(andOpen[1])];
      currents = [];
      continue;
    }
    // Design-stage blocks put the seq + first bullet on ONE line ("1 • text");
    // construction-stage puts the seq on its own line. Handle both.
    const combo = t.match(/^(\d{1,2})\s+[•o▪●○·]\s*(.*)$/);
    if (combo && inRange(Number(combo[1]))) {
      push();
      pendingAnd = null;
      setCurrents([Number(combo[1])]);
      buf = [combo[2].trim()];
      continue;
    }
    const seqM = t.match(/^(\d{1,2})$/);
    if (seqM && inRange(Number(seqM[1]))) {
      const n = Number(seqM[1]);
      if (pendingAnd) {
        pendingAnd.push(n);
        setCurrents(pendingAnd);
        pendingAnd = null;
        continue;
      }
      push();
      setCurrents([n]);
      continue;
    }
    if (BULLET_RE.test(t)) {
      push();
      buf = [t.replace(BULLET_RE, "").trim()];
    } else if (buf) {
      // Strip a trailing leaked page number before appending the continuation.
      buf.push(t.replace(/\s+\d{2,3}\s*$/, ""));
    }
  }
  push();
  return byReq;
}

// A matrix cell: a points integer, or "-"/"–"/"N/A" meaning not-applicable.
const CELL_RE = /^(\d+|[-–—]|n\/?a)$/i;
const cellValue = (c: string): number | null =>
  /^\d+$/.test(c) ? Number(c) : null;

// Scope row labels carry footnote markers in some credits ("Shell Only*"), which
// would otherwise fork one scope into two. Strip trailing marker glyphs so the
// scope vocabulary stays consistent across credits (and matches Table 4).
const normScope = (label: string): string =>
  cleanText(label.replace(/\s*[*¹²³⁴†‡]+\s*$/u, "").replace(/[-–]/g, " "));

const stripMarker = (s: string): string =>
  cleanText(s.replace(/\s*[*¹²³⁴†‡]+\s*$/u, ""));

/**
 * Rebuild typology column names from wrapped header lines. Do NOT split on `/`
 * — names like "Offices/Commercial/Government" are one column. Slash-wrapped
 * lines join; a one-word line joins the next one-word line; a crowded last
 * line splits on distinct capitalized tokens. Falls back to [] if we cannot
 * recover exactly `cols` names (caller uses col1…colN).
 */
function recoverTypologyNames(headerLines: string[], cols: number): string[] {
  if (!headerLines.length || cols < 1) return [];

  // 1. Join slash-continuations ("Offices/" + "Commercial/" + "Government*").
  const joined: string[] = [];
  for (const raw of headerLines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = joined[joined.length - 1];
    if (prev && /[/-]$/.test(prev)) joined[joined.length - 1] = prev + line;
    else joined.push(line);
  }

  // 2. Join a lone Title-case word with the next lone Title-case word
  //    ("Educational" + "Institutions").
  const phrases: string[] = [];
  for (let i = 0; i < joined.length; i++) {
    const cur = joined[i];
    const next = joined[i + 1];
    const oneWord = (s: string) =>
      /^[A-Z][A-Za-z]+[*¹²³⁴†‡]*$/.test(s) && !s.includes("/");
    if (next && oneWord(cur) && oneWord(next)) {
      phrases.push(`${cur} ${next}`);
      i++;
    } else {
      phrases.push(cur);
    }
  }

  // 3. Split a crowded line into capitalized tokens; keep slash-compounds.
  const names: string[] = [];
  for (const p of phrases) {
    const parts = p.split(/\s{2,}|\s+/).filter(Boolean);
    if (parts.length <= 1) {
      names.push(stripMarker(p));
      continue;
    }
    // Split only a crowded line (3+ standalone names, or a slash-compound
    // plus extra tokens). "Educational Institutions" stays one name.
    const allStandalone = parts.every(
      (w) => /^[A-Z]/.test(w) && !w.includes("/"),
    );
    const hasCompound = parts.some((w) => w.includes("/"));
    if ((allStandalone && parts.length >= 3) || (hasCompound && parts.length > 1)) {
      for (const w of parts) names.push(stripMarker(w));
    } else {
      names.push(stripMarker(p));
    }
  }

  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  return cleaned.length === cols ? cleaned : [];
}

/**
 * Parse the Credit Applicability Conditions matrix (scope → typology → pts).
 *
 * Both the scope row labels and the typology column headers are DETECTED from
 * the document, not hardcoded — the vocabulary differs across the Mostadam
 * family. A scope row is any line ending in a run of matrix cells (digits/"-");
 * its leading words are the scope label. Typology names come from the header
 * line(s) between the section title and the first data row; if they can't be
 * cleanly recovered we fall back to positional keys ("col1"…) so the numbers
 * are never lost (the LLM shape step can rename them later).
 */
function parseApplicability(
  lines: Line[],
  from: number,
  to: number,
): Applicability | null {
  const hdr = findLine(lines, from, to, /^Credit\s+Applicability\s+Conditions/i);
  if (hdr < 0) return null;

  // First pass: find the data rows (trailing run of >=2 matrix cells) and the
  // widest cell count, so we know how many typology columns there are.
  interface Row {
    label: string;
    cells: (number | null)[];
  }
  const rows: Row[] = [];
  const headerLines: string[] = [];
  for (let i = hdr + 1; i < Math.min(hdr + 40, to); i++) {
    const t = lines[i].text.trim();
    if (!t) continue;
    // Stop at the next block (evidence/guidance/tool/references/next section).
    if (
      /Stage\s+Evidence$/i.test(t) ||
      /^#?\s*Evidence/i.test(t) ||
      /^(Supporting\s+Guidance|Credit\s+Tool|Reference\s+Documents)/i.test(t)
    )
      break;
    const tokens = t.split(/\s+/).filter(Boolean);
    // Trailing run of matrix cells.
    let k = tokens.length;
    while (k > 0 && CELL_RE.test(tokens[k - 1])) k--;
    const cellTokens = tokens.slice(k);
    if (cellTokens.length >= 2 && k > 0) {
      rows.push({
        label: tokens.slice(0, k).join(" "),
        cells: cellTokens.map(cellValue),
      });
    } else {
      // Non-data line before the first row = part of the typology header.
      if (rows.length === 0) headerLines.push(t);
    }
  }
  if (!rows.length) return null;

  const cols = Math.max(...rows.map((r) => r.cells.length));
  const headerNames = recoverTypologyNames(headerLines, cols);
  const typologies =
    headerNames.length === cols
      ? headerNames
      : Array.from({ length: cols }, (_, i) => `col${i + 1}`);

  const matrix: Applicability = {};
  for (const r of rows) {
    const row: Record<string, number | null> = {};
    typologies.forEach((typ, idx) => {
      row[typ] = idx < r.cells.length ? r.cells[idx] : null;
    });
    matrix[normScope(r.label)] = row;
  }
  return Object.keys(matrix).length ? matrix : null;
}

/** Capture the Supporting Guidance block text (auditors need the thresholds). */
function parseSupportingGuidance(
  lines: Line[],
  from: number,
  to: number,
): string | null {
  const start = findLine(lines, from, to, /^Supporting\s+Guidance$/i);
  if (start < 0) return null;
  const stop = findLine(lines, start + 1, to, /^(Credit\s+Tool|Reference\s+Documents)$/i);
  const endAt = stop >= 0 ? stop : to;
  const text = cleanText(
    lines
      .slice(start + 1, endAt)
      .map((l) => l.text)
      .filter(Boolean)
      .join(" "),
  );
  return text || null;
}

interface ReqHeader {
  keystone: boolean;
  points: string | null;
}

/**
 * Parse the credit's opening "Credit Requirements … Points Allocated" block —
 * rows like "Requirement #1 No 1" (or "… No No 1" in O+E, "Option 1 –
 * Requirement #1 Yes 5" for options). This block is the AUTHORITATIVE source of
 * each requirement's keystone flag and points, so it overrides values scraped
 * from the body table (which can pick up a stray number from an embedded rating
 * table — see SS-06). Column count varies across the family, so we take the
 * first Yes/No as keystone and the LAST integer on the row as points.
 */
function parseReqHeader(
  lines: Line[],
  from: number,
  to: number,
): Map<number, ReqHeader> {
  const map = new Map<number, ReqHeader>();
  for (let i = from; i < Math.min(from + 14, to); i++) {
    const m = lines[i].text.match(/Requirement\s*#(\d+)\b(.*)$/i);
    if (!m) continue;
    const seq = Number(m[1]);
    const rest = m[2];
    const ks = /\b(Yes|No)\b/i.exec(rest);
    const nums = rest.match(/\d+/g);
    if (!map.has(seq)) {
      map.set(seq, {
        keystone: ks ? /yes/i.test(ks[1]) : false,
        points: nums ? nums[nums.length - 1] : null,
      });
    }
  }
  return map;
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

// A requirement whose points scale with performance (%, band, "dependent on…")
// rather than a flat award. Used to tag point_type without hardcoding a credit.
const SCALED_RE =
  /(number of points awarded is dependent|percentage improvement|scaled|per\s+band|awarded per|refer to supporting guidance below for more details)/i;

function classifyPointsType(text: string): "fixed" | "scaled" {
  return SCALED_RE.test(text) ? "scaled" : "fixed";
}

/**
 * Walk ONE "# Requirement Points Available … Total N" table between [from,to).
 * Sequence markers restart at 1 per table; the trailing standalone integer on a
 * row is its points. Returns the rows plus the table's declared `Total`.
 */
function walkReqTable(
  lines: Line[],
  from: number,
  to: number,
): { reqs: ParsedRequirement[]; total: string | null } {
  const totalIdx = findLine(lines, from, to, /^Total\b/i);
  const total =
    totalIdx >= 0 ? (lines[totalIdx].text.match(/Total\s+(\d+)/i)?.[1] ?? null) : null;

  let bodyStart = from;
  const colHdr = findLine(lines, from, Math.min(from + 6, to), /Points\s+Available/i);
  if (colHdr >= 0) bodyStart = colHdr + 1;
  const bodyEnd = totalIdx >= 0 ? totalIdx : to;

  const reqs: ParsedRequirement[] = [];
  let expected = 1;
  let cur: { seq: number; page: number; buf: string[] } | null = null;
  const emptySeqs: { seq: number; page: number }[] = [];
  // A row can begin either as the bare seq on its own line, or combined as
  // "<seq> <text> … <points>" on one line (both occur across the family).
  // Mid-sentence wraps ("3 additional amenities") must NOT start a new row —
  // only treat the combo as a new seq when the remainder looks like a row start.
  const looksLikeNewRow = (rest: string): boolean => {
    const s = rest.trim();
    if (!s) return false;
    if (/^[a-z]/.test(s)) return false;
    return /^[A-Z(0-9]/.test(s) || BULLET_RE.test(s);
  };
  const comboStart = (t: string): string | null => {
    const m = t.match(/^(\d{1,2})\s+(\S.*)$/);
    if (!m || Number(m[1]) !== expected) return null;
    return looksLikeNewRow(m[2]) ? m[2] : null;
  };
  const makeReq = (
    seq: number,
    page: number,
    title: string | null,
    text: string,
    points: string | null,
  ): ParsedRequirement => ({
    seq,
    title,
    text,
    pointsRaw: points,
    pointsType: classifyPointsType(text),
    optionGroup: null,
    keystone: false,
    keystoneCondition: null,
    metricType: "DESCRIPTIVE",
    unit: null,
    numericSpec: null,
    evidence: [],
    pageStart: page,
    pageEnd: page,
  });
  const flush = () => {
    if (!cur) return;
    let points: string | null = null;
    const textLines: string[] = [];
    for (const b of cur.buf) {
      if (/^\d{1,2}$/.test(b) && points === null && cur.buf.indexOf(b) === cur.buf.length - 1) {
        points = b;
      } else {
        textLines.push(b);
      }
    }
    if (points === null) {
      for (let k = cur.buf.length - 1; k >= 0; k--) {
        if (/^\d{1,2}$/.test(cur.buf[k])) {
          points = cur.buf[k];
          textLines.splice(k, 1);
          break;
        }
      }
    }
    // Combined "… text. 3" rows: split a trailing bare points integer off the
    // last text line (the "Points Available" column ran into the text).
    if (points === null && textLines.length) {
      const last = textLines[textLines.length - 1].match(/^(.*\S)\s+(\d{1,2})$/);
      if (last) {
        textLines[textLines.length - 1] = last[1];
        points = last[2];
      }
    }
    const title = extractTitle(textLines);
    const text = cleanText((title ? textLines.slice(1) : textLines).join(" "));
    // Drop empty/degenerate rows (D2) and stray "Total" rows (D1). Remember
    // the empty seq so a following pass can steal a leftover bullet.
    if ((text || title) && !/^total\b/i.test(text)) {
      reqs.push(makeReq(cur.seq, cur.page, title, text, points));
    } else if (!text && !title) {
      emptySeqs.push({ seq: cur.seq, page: cur.page });
    }
    cur = null;
  };

  for (let i = bodyStart; i < bodyEnd; i++) {
    const t = lines[i].text;
    if (!t) continue;
    const combo = comboStart(t);
    if (t === String(expected) || combo !== null) {
      flush();
      cur = { seq: expected, page: lines[i].page, buf: combo !== null ? [combo] : [] };
      expected++;
      continue;
    }
    if (cur) cur.buf.push(t);
  }
  flush();

  // Empty numbered row after a multi-bullet previous row: the last bullet
  // belongs to the empty seq (HC-16: two bullets under #1, bare "2").
  for (const empty of emptySeqs) {
    const prev = [...reqs].reverse().find((r) => r.seq < empty.seq);
    if (!prev) continue;
    const parts = prev.text.split(/\s+•\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const stolen = parts.pop()!;
    prev.text = parts.join(" • ");
    prev.pointsType = classifyPointsType(prev.text);
    reqs.push(makeReq(empty.seq, empty.page, null, stolen, null));
    reqs.sort((a, b) => a.seq - b.seq);
  }

  return { reqs, total };
}

// Where the requirements region ends: the next known block.
const REQ_REGION_END_RE =
  /^(Credit\s+Applicability\s+Conditions|.*Stage\s+Evidence$|#?\s*Evidence|Supporting\s+Guidance|Credit\s+Tool|Reference\s+Documents)/i;
const OPTION_HDR_RE = /^Option\s+(\d+)\s*[–—-]\s*(.+)$/i;

/**
 * Parse a credit's requirements. Most credits have one requirements table; some
 * (e.g. E-01) offer mutually-exclusive Options, each its OWN sub-table with its
 * own `Total`. Options are an XOR set: they share an `option_group` and the
 * credit's points is the MAX option total, not the sum (B5/E-01). Detected from
 * "Option N – …" sub-headers, not hardcoded to any credit.
 */
function parseRequirements(
  lines: Line[],
  section: Section,
): { requirements: ParsedRequirement[]; totalPoints: string | null } {
  const { start, end } = section;
  const reqHdr = findLine(lines, start, end, /^Requirements$/i);
  if (reqHdr < 0) return { requirements: [], totalPoints: null };

  let regionEnd = findLine(lines, reqHdr + 1, end, REQ_REGION_END_RE);
  if (regionEnd < 0) regionEnd = end;

  // Option sub-headers within the requirements region only.
  const opts: { i: number; label: string }[] = [];
  for (let i = reqHdr + 1; i < regionEnd; i++) {
    const m = lines[i].text.match(OPTION_HDR_RE);
    if (m) opts.push({ i, label: cleanText(m[2]) });
  }

  if (opts.length >= 2) {
    const requirements: ParsedRequirement[] = [];
    const optionTotals: number[] = [];
    const groupLabel = `${section.code} options`;
    let seqBase = 0;
    for (let o = 0; o < opts.length; o++) {
      const from = opts[o].i + 1;
      const to = o + 1 < opts.length ? opts[o + 1].i : regionEnd;
      const { reqs, total } = walkReqTable(lines, from, to);
      if (total != null) optionTotals.push(Number(total));
      for (const r of reqs) {
        r.seq = ++seqBase; // options restart at 1; renumber across the credit
        r.optionGroup = groupLabel;
        if (!r.title) r.title = opts[o].label;
        requirements.push(r);
      }
    }
    // XOR: the credit is worth its best option, never the sum.
    const totalPoints = optionTotals.length ? String(Math.max(...optionTotals)) : null;
    return { requirements, totalPoints };
  }

  const { reqs, total } = walkReqTable(lines, reqHdr + 1, regionEnd);
  return { requirements: reqs, totalPoints: total };
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

    // Requirement-level keystone + authoritative points from the credit's header
    // block; credit-level keystone is overridden later from Table 3 (parseManual).
    const reqHeader = parseReqHeader(lines, start, end);
    const isKeystone = [...reqHeader.values()].some((h) => h.keystone);

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

    // Evidence per requirement, separated by design/construction stage.
    const evByReq = parseEvidenceByStage(lines, start, end, requirements.length || 9);
    // The header "Points Allocated" column is only a per-requirement value when
    // it lists a line PER requirement. When it collapses the credit into a
    // single summary line ("Requirement #1 Yes 3" for a 3-req credit, or
    // "Requirement #1 & #2 Yes 2"), that number is the CREDIT total, not seq 1's
    // points — so only trust it when the header covers at least every
    // requirement (>= the count). Keystone flags are always taken from the header.
    const headerPointsReliable = reqHeader.size >= requirements.length;
    for (const r of requirements) {
      r.evidence = evByReq.get(r.seq) ?? [];
      const h = reqHeader.get(r.seq);
      if (h) {
        r.keystone = h.keystone;
        if (headerPointsReliable && h.points != null) r.pointsRaw = h.points;
      }
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

    // Points-achieved band tables → the scaled requirement(s) of this credit.
    const bandSets = parsePointsTables(lines, start, end);
    if (bandSets.length) {
      const targets = requirements.filter((r) => r.pointsType === "scaled");
      for (const r of targets) {
        r.numericSpec = { ...(r.numericSpec ?? {}), bands: bandSets };
        r.metricType = "NUMERIC";
        if (!r.unit) r.unit = "%";
      }
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

    const applicability = parseApplicability(lines, start, end);
    const supportingGuidance = parseSupportingGuidance(lines, start, end);

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
      supportingGuidance,
      applicability,
      reconciliation: null, // filled by parseManual after document-wide passes
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      requirements,
    });
  }

  return credits;
}
