import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { parsedCredits, rsVersions, sourceDocuments } from "./schema";
import {
  ensureRatingSystem,
  ensureVersion,
  promoteToCatalog,
  WORKSPACE_ID,
} from "../lib/catalog";
import { parseAndStore } from "../lib/parser";

/**
 * Authors the canonical catalog by running the REAL parser on the public
 * Commercial D+C manual and promoting HC-10 (only) into the catalog. This is the
 * "parse once → curate → catalog" flow, exercised end-to-end. Idempotent.
 *
 * Scope for now: Mostadam ▸ Commercial D+C 2019 ▸ HC-10 only.
 */

const MANUAL_PATH = ".data/manuals/commercial-dc.pdf";
const MANUAL_URL =
  "https://subdivision-prod.ruh-s3.bluvalt.com/s3fs-public/mostadam/2024-05/Mostadam%20for%20Commercial%20Buildings%20(D+C).pdf";
const PROMOTE_CODES = ["HC-10"];

async function ensureManual() {
  if (existsSync(MANUAL_PATH)) return;
  console.log("manual not found — downloading…");
  mkdirSync(".data/manuals", { recursive: true });
  const res = await fetch(MANUAL_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  await writeFile(MANUAL_PATH, Buffer.from(await res.arrayBuffer()));
  console.log("downloaded manual");
}

async function main() {
  await ensureManual();

  const ratingSystemId = await ensureRatingSystem({
    key: "mostadam",
    name: "Mostadam",
    authority: "Ministry of Municipal and Rural Affairs and Housing",
    country: "Saudi Arabia",
  });
  const versionId = await ensureVersion({
    ratingSystemId,
    scheme: "commercial",
    stage: "D+C",
    versionLabel: "2019",
    status: "published",
  });
  console.log("rating system + version ready:", versionId);

  // Fresh source document + parser run for this authoring pass.
  const docId = randomUUID();
  await db.insert(sourceDocuments).values({
    id: docId,
    workspaceId: WORKSPACE_ID,
    rsVersionId: versionId,
    // Prefixed so seeded/test data is obvious in the catalog UI vs real uploads.
    fileName: "[SEED] Mostadam for Commercial Buildings (D+C).pdf",
    filePath: MANUAL_PATH,
    fileSize: 0,
    status: "uploaded",
  });
  await db
    .update(rsVersions)
    .set({ sourceDocumentId: docId })
    .where(eq(rsVersions.id, versionId));

  console.log("parsing manual…");
  const result = await parseAndStore(docId);
  if (!result.ok) throw new Error(`parse failed: ${result.reason}`);
  console.log(`parsed ${result.credits.length} credits`);

  // Promote only the target codes.
  const toPromote = await db
    .select({ id: parsedCredits.id, code: parsedCredits.code })
    .from(parsedCredits)
    .where(eq(parsedCredits.sourceDocumentId, docId));
  const ids = toPromote
    .filter((c) => PROMOTE_CODES.includes(c.code))
    .map((c) => c.id);
  if (ids.length === 0)
    throw new Error(`none of ${PROMOTE_CODES.join(", ")} were parsed`);

  const { promoted } = await promoteToCatalog(versionId, ids);
  console.log(`promoted ${promoted} credit(s) into the catalog: ${PROMOTE_CODES.join(", ")}`);
  console.log("catalog seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
