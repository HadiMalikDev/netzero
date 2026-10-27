import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { materialFixture } from "./helpers/material-fixture";
import { db } from "@/db";
import { evidenceDocs } from "@/db/schema";
import { WORKSPACE_ID } from "@/lib/catalog";

const fx = materialFixture();

describeDb("material review: files", () => {
  beforeAll(() => fx.setup());
  afterAll(() => fx.teardown());

  const doc = (over: Partial<typeof evidenceDocs.$inferInsert>) => ({
    id: randomUUID(),
    workspaceId: WORKSPACE_ID,
    fileName: "x.pdf",
    filePath: "/dev/null",
    ...over,
  });

  it("a file belongs to a credit or to a product, never both and never neither", async () => {
    const productId = await fx.addProduct(await fx.addSubmittal());
    const pcId = fx.pcByCode.get("MW-05")!;

    const onCredit = doc({ projectCreditId: pcId });
    const onProduct = doc({ materialProductId: productId, issuedOn: "2024-05-12" });
    await db.insert(evidenceDocs).values([onCredit, onProduct]);
    const [saved] = await db.select().from(evidenceDocs).where(eq(evidenceDocs.id, onProduct.id));
    expect(saved).toMatchObject({ projectCreditId: null, materialProductId: productId, issuedOn: "2024-05-12" });

    await expect(db.insert(evidenceDocs).values(doc({}))).rejects.toThrow();
    await expect(
      db.insert(evidenceDocs).values(doc({ projectCreditId: pcId, materialProductId: productId })),
    ).rejects.toThrow();
  });
});
