import React from "react";
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * What every NetZero PDF shares: the WinAnsi text filter, the palette, the A4
 * page frame with its footer, and the small pill. Built on @react-pdf's
 * built-in Helvetica (no external fonts, so rendering is offline and
 * deterministic). Used by the catalog extraction-review report and the
 * per-credit compliance checklist.
 */

/**
 * Let long unbreakable tokens (UUID filenames, URLs in reference text) wrap
 * inside narrow cells instead of overflowing; normal words pass through intact.
 * MUST be called from the same module that calls `renderToBuffer` — the callback
 * binds to that entry's `@react-pdf` instance, so registering it from another
 * import does not take effect. Each PDF route calls this before rendering.
 */
export function registerPdfHyphenation(): void {
  Font.registerHyphenationCallback((word) =>
    word.length > 16 ? (word.match(/.{1,14}/g) ?? [word]) : [word],
  );
}

/**
 * The built-in Helvetica is WinAnsi-only — a glyph outside that set (e.g. ≤, ≥,
 * ✓, or any exotic char in the parsed manual text) has no width and makes
 * @react-pdf throw "unsupported number". `safe()` maps the common technical
 * symbols to ASCII and drops anything else that WinAnsi can't encode, so
 * arbitrary catalog text can never crash the render. Applied to every
 * DB-derived string.
 */
const SYMBOL_MAP: Record<string, string> = {
  "≤": "<=",
  "≥": ">=",
  "≈": "~",
  "≠": "!=",
  "×": "x",
  "÷": "/",
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "✓": "[ok]",
  "✔": "[ok]",
  "✗": "[x]",
  "⚠": "[!]",
  "√": "sqrt",
  "∆": "delta",
  "Δ": "delta",
  "Ω": "ohm",
  "∞": "inf",
  "−": "-", // U+2212 minus, as in the manual's equations
  "⁄": "/", // U+2044 fraction slash
  "∑": "sum",
  "∙": "·",
};
// Codepoints > 0xFF that WinAnsi still encodes (punctuation in the 0x80–0x9F map).
const WINANSI_EXTRA = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020,
  0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122, 0x0152,
  0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192, 0x02c6, 0x02dc,
]);
const winAnsi = (code: number) => code <= 0xff || WINANSI_EXTRA.has(code);

export function safe(input: string | null | undefined): string {
  if (!input) return "";
  let out = "";
  for (const ch of input) {
    const mapped = SYMBOL_MAP[ch];
    if (mapped != null) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0)!;
    if (winAnsi(code)) {
      out += ch;
      continue;
    }
    // The manual sets its equations in Unicode "mathematical italic" letters
    // (𝑅 − 𝑣𝑎𝑙𝑢𝑒 → R - value). Compatibility normalisation folds those, and
    // the like (ℎ, fullwidth forms), back to plain letters. Only taken when
    // every resulting char is encodable; otherwise the glyph is unknown.
    const folded = ch.normalize("NFKC");
    if (folded !== ch && [...folded].every((c) => winAnsi(c.codePointAt(0)!))) out += folded;
    else out += "?";
  }
  return out;
}

export const C = {
  ink: "#0f172a", // slate-900
  body: "#334155", // slate-700
  muted: "#64748b", // slate-500
  faint: "#94a3b8", // slate-400
  line: "#e2e8f0", // slate-200
  panel: "#f8fafc", // slate-50
  brand: "#0f766e", // teal-700 (accent)
  brandBg: "#f0fdfa", // teal-50
  amber: "#b45309", // amber-700
  amberBg: "#fffbeb", // amber-50
  red: "#b91c1c",
  redBg: "#fef2f2",
  green: "#15803d",
  greenBg: "#f0fdf4",
};

export const base = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.body,
    lineHeight: 1.4,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 16,
    marginTop: 4,
  },
  metaCell: { width: "50%", marginBottom: 12, paddingRight: 12 },
  metaLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: C.faint,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  metaValue: { fontSize: 11, color: C.ink },
  // generic pill
  pill: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    marginLeft: 4,
  },
  pillKeystone: {
    color: C.amber,
    backgroundColor: C.amberBg,
    borderColor: "#fcd34d",
  },
  pillPoints: {
    color: C.brand,
    backgroundColor: C.brandBg,
    borderColor: "#99f6e4",
  },
  sectionLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: C.faint,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 3,
  },
  // sub-panel
  panel: {
    marginTop: 4,
    padding: 6,
    backgroundColor: C.panel,
    borderRadius: 3,
  },
  panelLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    marginBottom: 2,
  },
  li: { fontSize: 8.5, color: C.body, marginBottom: 1 },
  // A4 content width is 595.28 − 2×44 ≈ 507. Fixed footer elements MUST carry
  // explicit width AND height: a `fixed` + `render` box without them makes
  // @react-pdf compute a non-finite offset across many pages and throw
  // "unsupported number". Kept as two separately-positioned elements (a row
  // wrapper around a render child triggers the same bug).
  footerRule: {
    position: "absolute",
    bottom: 33,
    left: 44,
    width: 507,
    height: 1,
    backgroundColor: C.line,
  },
  footerLeft: {
    position: "absolute",
    bottom: 22,
    left: 44,
    width: 380,
    height: 10,
    fontSize: 7.5,
    color: C.faint,
  },
  footerRight: {
    position: "absolute",
    bottom: 22,
    right: 44,
    width: 120,
    height: 10,
    textAlign: "right",
    fontSize: 7.5,
    color: C.faint,
  },
});

/**
 * The page footer: a rule, a left-hand label, and "n / total" on the right.
 * `contentWidth` is the page width less margins: 507 on A4 portrait (the
 * default), 754 on landscape.
 */
export function Footer({ left, contentWidth = 507 }: { left: string; contentWidth?: number }) {
  return (
    <>
      <View style={[base.footerRule, { width: contentWidth }]} fixed />
      <Text style={base.footerLeft} fixed>
        {left}
      </Text>
      <Text
        style={base.footerRight}
        fixed
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </>
  );
}

export function Pill({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "keystone" | "points";
}) {
  const extra =
    variant === "keystone"
      ? base.pillKeystone
      : variant === "points"
        ? base.pillPoints
        : null;
  return <Text style={extra ? [base.pill, extra] : base.pill}>{children}</Text>;
}
