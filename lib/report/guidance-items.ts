/**
 * Pull the itemised lists out of a credit's stored supporting guidance.
 *
 * The parser stores guidance as one flattened string (the manual's lines joined
 * with spaces), but the list markers survive: lettered sections (`a) … b) …`),
 * bullets (`•`) and the manual's sub-bullets (`o`). On HC-10 that is the six
 * SMACNA control measures; on SS-03 the seven CEMP sections and their bullets.
 * The compliance-checklist PDF prints these as "what the manual requires the
 * plan to contain", so they must come out clean or not at all: a wrong row on
 * a compliance document is worse than no row. Anything that is not clearly a
 * list is left out, and a guidance string with no list yields `[]`.
 *
 * Not re-parsed from the PDF: this reads the stored string, so it works on
 * every catalog version already in the database.
 */

export interface GuidanceItem {
  text: string;
  children: GuidanceItem[];
}

export interface GuidanceList {
  /** A "Heading:" phrase that introduced the list, e.g. "Environmental Professional". */
  heading: string | null;
  /** The sentence that introduced the list, e.g. "The CEMP must include the following as a minimum:". */
  intro: string | null;
  items: GuidanceItem[];
}

type Kind = "letter" | "bullet" | "circle";
const RANK: Record<Kind, number> = { letter: 0, bullet: 1, circle: 2 };

interface Marker {
  kind: Kind;
  letter: string | null;
  /** Index in the text where the marker token starts (incl. its leading space). */
  start: number;
  /** Index right after the marker token and its trailing space. */
  end: number;
}

// A marker is a whole token: "a) ", "• ", "o " — each preceded by whitespace or
// the start of the string.
const MARKER_RE = /(^|\s)(?:([a-z])\)|(•)|(o))\s+/g;

/**
 * Page numbers leak into the flattened text at page breaks ("…design. 182 Indoor
 * Air Quality Testing", "…controls. 41 o Workers"). A standalone 1–3 digit
 * number right after a sentence end, a colon or a marker, and right before a
 * capitalised word or a marker, is one of those. A number inside a sentence
 * ("equals 2 Air Changes", "1 per 2,500m2") has a lowercase word before it and
 * is left alone.
 */
const PAGE_NUMBER_RE = /([.:]|\s[a-z]\)|\s•|\so)\s+\d{1,3}(?=\s+(?:[A-Z]|•|o\s|[a-z]\)))/g;

function stripPageNumbers(text: string): string {
  return text.replace(PAGE_NUMBER_RE, "$1");
}

function findMarkers(text: string): Marker[] {
  const out: Marker[] = [];
  let expectLetter = "a";
  for (const m of text.matchAll(MARKER_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (m[2]) {
      // Lettered sections only count in sequence (a, b, c…); a lone "e)" in
      // prose is text, not a marker.
      if (m[2] !== expectLetter) continue;
      expectLetter = String.fromCharCode(m[2].charCodeAt(0) + 1);
      out.push({ kind: "letter", letter: m[2], start, end });
    } else if (m[3]) {
      out.push({ kind: "bullet", letter: null, start, end });
    } else {
      out.push({ kind: "circle", letter: null, start, end });
    }
  }
  return out;
}

// "Environmental Professional:" — one to six capitalised words ending in a
// colon, standing at the start of the segment or after a sentence end. The
// marker that follows it opens a new list under that heading.
const HEADING_WORD = "[A-Z][\\w&'’/()-]*";
const HEADING_RE = new RegExp(
  `(?:^|\\.\\s+)((?:${HEADING_WORD}\\s+){0,5}${HEADING_WORD}):(?=\\s|$)`,
);

// The same phrase closing the prose ("… 15 40% Additional Clarifications:").
const HEADING_AT_END_RE = new RegExp(
  `(?:^|\\s)((?:${HEADING_WORD}\\s+){0,5}${HEADING_WORD}):\\s*$`,
);

/**
 * The sentence that introduces a list ("The CEMP must include the following as
 * a minimum:"). Only a sentence ending in a colon counts; anything else before
 * the first marker is the manual's prose or table noise, not an intro.
 */
function introSentence(prose: string): string | null {
  const parts = prose
    .trim()
    .split(/(?<=\.)\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || !last.endsWith(":") || last.length > 240) return null;
  return last;
}

function introOf(rawProse: string): { heading: string | null; intro: string | null } {
  const prose = rawProse.trim();
  const atEnd = HEADING_AT_END_RE.exec(prose);
  if (atEnd) {
    const before = prose.slice(0, atEnd.index).trim();
    return { heading: atEnd[1], intro: introSentence(before) };
  }
  const h = HEADING_RE.exec(prose);
  if (h) {
    const after = prose.slice(h.index + h[0].length).trim();
    return { heading: h[1], intro: introSentence(after) };
  }
  return { heading: null, intro: introSentence(prose) };
}

/**
 * Where, inside the segment that follows the last item of a list, does that
 * item stop and the next heading begin? Only a heading after a sentence end
 * counts, so a bullet with two sentences stays whole.
 */
function headingBreak(segment: string): number {
  const re = new RegExp(`\\.\\s+(?=(?:${HEADING_WORD}\\s+){0,5}${HEADING_WORD}:(?:\\s|$))`);
  const m = re.exec(segment);
  return m ? m.index + 1 : -1;
}

// Words that start a sentence but never a label or list item, as a signal that
// the list has ended and the manual's prose resumed.
const SENTENCE_STARTERS = new Set([
  "The",
  "This",
  "These",
  "It",
  "In",
  "For",
  "Prior",
  "Refer",
  "Where",
  "If",
  "When",
  "Each",
  "Note",
]);

/**
 * The last item of a list has the manual's following prose glued onto it
 * ("Scheduling The Plan must enlist…"). Returns where that prose starts: the
 * first sentence end, or the first capitalised sentence-starter after the first
 * word, whichever comes first; `text.length` when there is none. Interior
 * items are never cut.
 */
function proseStartIn(text: string): number {
  let cutAt = text.length;
  const sentence = /\.\s+(?=[A-Z])/.exec(text);
  if (sentence) cutAt = sentence.index + 1;
  let pos = 0;
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (i > 0 && SENTENCE_STARTERS.has(w)) {
      cutAt = Math.min(cutAt, pos);
      break;
    }
    pos += w.length + 1;
  }
  return cutAt;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function guidanceLists(guidance: string | null | undefined): GuidanceList[] {
  if (!guidance) return [];
  const text = stripPageNumbers(guidance);
  const markers = findMarkers(text);
  if (!markers.length) return [];

  const lists: GuidanceList[] = [];
  let current: GuidanceList | null = null;
  let topRank = 0;
  // The open item at each depth (0 = top level), so a sub-bullet attaches to
  // the nearest shallower item even when a depth was skipped (`a)` straight to
  // `o`, as HC-10's testing list does).
  let open: (GuidanceItem | undefined)[] = [];

  /**
   * Close the current list. `lastSegment` is the text after its final marker;
   * the deepest open item keeps the part before the manual's prose resumes,
   * and the prose is returned for the next list's heading.
   */
  const closeList = (lastSegment: string): string => {
    if (!current) return lastSegment;
    const seg = clean(lastSegment);
    const cut = proseStartIn(seg);
    const deepest = [...open].reverse().find(Boolean);
    if (deepest) deepest.text = clean(seg.slice(0, cut));
    if (current.items.length) lists.push(current);
    current = null;
    open = [];
    return seg.slice(cut);
  };

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const next = markers[i + 1];
    const segment = text.slice(m.end, next ? next.start : text.length);
    const rank = RANK[m.kind];

    // Does this marker open a new list, and what prose precedes it?
    let opens = !current || rank < topRank;
    let prose = "";
    if (current) {
      // The previous item's segment ran up to this marker. A heading after a
      // sentence end inside it means the list ended there.
      const prevSeg = text.slice(markers[i - 1].end, m.start);
      const brk = headingBreak(prevSeg);
      if (brk >= 0) {
        closeList(prevSeg.slice(0, brk));
        prose = prevSeg.slice(brk);
        opens = true;
      } else if (opens) {
        prose = closeList(prevSeg);
      }
    } else {
      prose = text.slice(0, m.start);
    }

    if (opens) {
      const { heading, intro } = introOf(prose);
      current = { heading, intro, items: [] };
      topRank = rank;
      open = [];
    }

    const item: GuidanceItem = { text: clean(segment), children: [] };
    const depth = rank - topRank;
    open.length = depth;
    const parent = depth > 0 ? [...open].reverse().find(Boolean) : undefined;
    if (parent) parent.children.push(item);
    else current!.items.push(item);
    open[depth] = item;
  }

  // The last marker's segment runs to the end of the text.
  closeList(text.slice(markers[markers.length - 1].end));

  // Letter prefixes are implied by position; drop empty items.
  const prune = (items: GuidanceItem[]): GuidanceItem[] =>
    items
      .map((it) => ({ text: it.text, children: prune(it.children) }))
      .filter((it) => it.text.length > 0 || it.children.length > 0);
  return lists
    .map((l) => ({ ...l, items: prune(l.items) }))
    .filter((l) => l.items.length > 0);
}

/** Total number of rows a list set would print, at every depth. */
export function countItems(lists: GuidanceList[]): number {
  const walk = (items: GuidanceItem[]): number =>
    items.reduce((n, it) => n + 1 + walk(it.children), 0);
  return lists.reduce((n, l) => n + walk(l.items), 0);
}
