import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { describeDb } from "./helpers/postgres";
import { materialFixture } from "./helpers/material-fixture";

// The model is stubbed: this checks what is done with its answer, not the model.
const answer = vi.hoisted(() => ({ value: {} as Record<string, unknown>, prompt: "" }));
vi.mock("@/lib/ai/openrouter", () => ({
  hasLLM: () => true,
  chatJSON: async (messages: { content: string }[]) => {
    answer.prompt = messages.map((m) => m.content).join("\n");
    return answer.value;
  },
}));

import { fillProductFromFiles } from "@/lib/ai/product-header";
import { createUploadedSubmittal, getProduct, nameFromFiles, saveProductHeader } from "@/lib/materials/products";
import { UPLOAD_ROOT } from "@/lib/uploads";

const fx = materialFixture();

describeDb("AI fills an uploaded product's information (D46)", () => {
  let smq: File;
  beforeAll(async () => {
    await fx.setup();
    smq = new File([await readFile(join(__dirname, "fixtures/smq-sikaflex.pdf"))], "SMQ Sikaflex 11FC.pdf", { type: "application/pdf" });
  });
  afterAll(async () => {
    await rm(join(UPLOAD_ROOT, fx.projectId), { recursive: true, force: true });
    await fx.teardown();
  });

  it("reads the files and fills the empty fields and the material types on the list", async () => {
    const queued = { datasheet: [], boq: [], smq: [smq] };
    const { productIds } = (await createUploadedSubmittal(fx.projectId, { ref: "", title: "" }, [queued]))!;
    answer.value = {
      submittalRef: "JCD-OCN-MBL-PRO-MTS-0999",
      name: "Sikaflex-11 FC+ Polyurethane Joint Sealant",
      locationOfUse: "Interior movement joints",
      manufacturer: "Sika Saudi Arabia Co. Ltd",
      supplier: "Al Muhaidib Building Materials",
      countryOfOrigin: "Saudi Arabia",
      materialTypes: ["Adhesives & Sealants", "Not a type"],
    };
    const r = (await fillProductFromFiles(fx.projectId, productIds[0], nameFromFiles(queued)))!;
    expect(r.submittalRef).toBe("JCD-OCN-MBL-PRO-MTS-0999");
    // The file's text and the questionnaire's types went to the model.
    expect(answer.prompt).toContain("Material Subject: Sikaflex-11 FC+");
    expect(answer.prompt).toContain("- Adhesives & Sealants");

    const v = (await getProduct(fx.projectId, productIds[0]))!;
    expect(v.product).toMatchObject({ name: "Sikaflex-11 FC+ Polyurethane Joint Sealant", manufacturer: "Sika Saudi Arabia Co. Ltd", countryOfOrigin: "Saudi Arabia" });
    expect(v.sections.map((s) => s.heading)).toEqual(["General requirements", "Adhesives & Sealants"]);
  });

  it("never overwrites what someone already entered", async () => {
    const queued = { datasheet: [], boq: [], smq: [smq] };
    const { productIds } = (await createUploadedSubmittal(fx.projectId, { ref: "R", title: "T" }, [queued]))!;
    const blank = { locationOfUse: "", supplier: "", countryOfOrigin: "", contactName: "", contactMobile: "" };
    expect(await saveProductHeader(fx.projectId, productIds[0], { ...blank, name: "Typed name", manufacturer: "Typed maker" })).toBe(true);
    answer.value = { name: "Read name", manufacturer: "Read maker", countryOfOrigin: "Saudi Arabia", materialTypes: [] };
    await fillProductFromFiles(fx.projectId, productIds[0], nameFromFiles(queued));
    expect((await getProduct(fx.projectId, productIds[0]))!.product).toMatchObject({ name: "Typed name", manufacturer: "Typed maker", countryOfOrigin: "Saudi Arabia" });
  });
});
