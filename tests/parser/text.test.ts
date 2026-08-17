import { describe, expect, it } from "vitest";
import { cleanText } from "@/lib/parser/text";

describe("cleanText", () => {
  it("converts PUA bullet glyphs (U+F0B7) to readable bullets", () => {
    const dirty = `Recovered for:${String.fromCodePoint(0xf0b7)}Indoor units${String.fromCodePoint(0xf0b7)}FAHUs`;
    expect(cleanText(dirty)).toBe("Recovered for: • Indoor units • FAHUs");
  });

  it("strips the Unicode replacement char and stray PUA", () => {
    const dirty = `a�b${String.fromCodePoint(0xe123)}c`;
    expect(cleanText(dirty)).toBe("abc");
  });

  it("normalizes non-breaking / zero-width spaces and collapses runs", () => {
    expect(cleanText("a  b   c​d")).toBe("a b c d");
  });

  it("drops control characters but keeps normal text", () => {
    expect(cleanText("hello world")).toBe("hello world");
  });

  it("handles null/empty", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText("")).toBe("");
  });
});
