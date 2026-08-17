/**
 * Clean text extracted from a PDF. Mostadam manuals encode bullets and marks in
 * Symbol/Wingdings fonts that unpdf emits as Private-Use-Area codepoints (e.g.
 * U+F0B7 = a bullet), which render as unintelligible glyphs. This maps those to
 * readable characters and strips the rest. Codepoint-based to stay unambiguous.
 */

const BULLET = "•"; // •
const CHECK = "✓"; // ✓

// Symbol-font bullets in the PUA + real bullet characters.
const BULLET_CP = new Set([
  0xf0b7, 0xf0a7, 0xf06c, 0xf0a8, 0x2022, 0x25aa, 0x25cf, 0x25e6, 0x2023,
  0x2043, 0x00b7,
]);
// Symbol-font tick marks + real check characters.
const CHECK_CP = new Set([0xf0fc, 0xf0d8, 0x2713, 0x2714]);

function isControl(c: number): boolean {
  return (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f;
}

function isExoticSpace(c: number): boolean {
  return (
    c === 0x00a0 || // nbsp
    (c >= 0x2000 && c <= 0x200b) || // en/em/thin/zero-width spaces
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
}

export function cleanText(raw: string | null | undefined): string {
  if (!raw) return "";
  let out = "";
  for (const ch of raw) {
    const c = ch.codePointAt(0)!;
    if (BULLET_CP.has(c)) {
      out += ` ${BULLET} `;
    } else if (CHECK_CP.has(c)) {
      out += ` ${CHECK} `;
    } else if (c === 0xfffd) {
      // replacement char — drop
    } else if (c >= 0xe000 && c <= 0xf8ff) {
      // any other Private Use Area glyph — drop
    } else if (isControl(c)) {
      // drop
    } else if (isExoticSpace(c)) {
      out += " ";
    } else {
      out += ch;
    }
  }
  return out
    .replace(new RegExp(`\\s*${BULLET}\\s*`, "g"), ` ${BULLET} `)
    .replace(/[ \t]{2,}/g, " ")
    .replace(new RegExp(`^\\s*${BULLET}\\s*`), "")
    .trim();
}
