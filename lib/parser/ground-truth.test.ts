import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseManual } from "./index";
import groundTruth from "../../db/ground-truth.json";

/**
 * Structural diff of the deterministic parse against hand-authored ground truth.
 * The fixtures deliberately span BOTH the Commercial D+C and O+E manuals so a
 * regression that overfits to one layout (or breaks the other) fails here.
 * Manuals are large public PDFs; if a fixture is absent, that manual is skipped
 * so CI without the download stays green.
 */

interface CreditExpect {
  title?: string;
  categoryName?: string;
  isKeystone?: boolean;
  pointsRaw?: string;
  requirementCount?: number;
  optionGroup?: string;
}
interface ManualExpect {
  scheme: string;
  stage: string;
  pageCount: number;
  keystoneCount: number;
  keystoneCodes: string[];
  scopeTotals: Record<string, number> | null;
  scopesReconcile?: boolean;
  credits: Record<string, CreditExpect>;
}

const gt = groundTruth as unknown as Record<string, ManualExpect>;

for (const [file, expected] of Object.entries(gt)) {
  if (file.startsWith("_")) continue;
  const path = `.data/manuals/${file}`;
  const d = existsSync(path) ? describe : describe.skip;

  d(`ground truth · ${file}`, () => {
    it("matches document-level structure", async () => {
      const res = await parseManual(new Uint8Array(await readFile(path)));
      expect(res.ok).toBe(true);
      expect(res.scheme).toBe(expected.scheme);
      expect(res.stage).toBe(expected.stage);
      expect(res.pageCount).toBe(expected.pageCount);

      const keystone = res.credits.filter((c) => c.isKeystone).map((c) => c.code).sort();
      expect(keystone).toEqual([...expected.keystoneCodes].sort());
      expect(keystone.length).toBe(expected.keystoneCount);

      expect(res.scopeTotals).toEqual(expected.scopeTotals);
      if (expected.scopesReconcile) {
        expect(res.reconciliation?.scopes.every((s) => s.ok)).toBe(true);
      }
    });

    it("matches per-credit structure", async () => {
      const res = await parseManual(new Uint8Array(await readFile(path)));
      for (const [code, ce] of Object.entries(expected.credits)) {
        const c = res.credits.find((x) => x.code === code);
        expect(c, `${code} must be extracted`).toBeDefined();
        if (ce.title !== undefined) expect(c!.title).toBe(ce.title);
        if (ce.categoryName !== undefined) expect(c!.categoryName).toBe(ce.categoryName);
        if (ce.isKeystone !== undefined) expect(c!.isKeystone).toBe(ce.isKeystone);
        if (ce.pointsRaw !== undefined) expect(c!.pointsRaw).toBe(ce.pointsRaw);
        if (ce.requirementCount !== undefined)
          expect(c!.requirements.length).toBe(ce.requirementCount);
        if (ce.optionGroup !== undefined)
          expect(c!.requirements.every((r) => r.optionGroup === ce.optionGroup)).toBe(true);
      }
    });
  });
}
