import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safe } from "@/lib/pdf/shared";

// The PDFs use the built-in Helvetica, which is WinAnsi-only. safe() must turn
// every stored string into something it can set, without writing "?" over
// text a reader needs.
describe("safe", () => {
  it("passes Latin text, WinAnsi punctuation and ≤/≥ mappings through", () => {
    expect(safe("Ventilation – 2 ACH “flush-out” ≤ 500 µg/m³ façade")).toBe(
      "Ventilation – 2 ACH “flush-out” <= 500 µg/m³ façade",
    );
    expect(safe(null)).toBe("");
    expect(safe("")).toBe("");
  });

  it("folds the manual's mathematical-italic equations back to plain letters", () => {
    expect(safe("𝑅 − 𝑣𝑎𝑙𝑢𝑒 (𝑚2𝐾 𝑊⁄ ) = 𝑀𝑎𝑡𝑒𝑟𝑖𝑎𝑙 𝑇ℎ𝑖𝑐𝑘𝑛𝑒𝑠𝑠 (𝑚)")).toBe(
      "R - value (m2K W/ ) = Material Thickness (m)",
    );
    expect(safe("∑ 𝐴 x 𝑈")).toBe("sum A x U");
  });

  it("writes no question marks over E-01's stored guidance", () => {
    const out = safe(readFileSync("tests/fixtures/guidance-e01.txt", "utf8"));
    expect(out).not.toContain("?");
    expect(out).toContain("% Improvement = Baseline Annual Energy Consumption");
  });

  it("still marks a glyph it cannot fold", () => {
    expect(safe("tick ✓ box ☐ arabic م")).toBe("tick [ok] box ? arabic ?");
  });
});
