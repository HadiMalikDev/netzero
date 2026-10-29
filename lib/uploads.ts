import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Where uploaded files live, one folder per project. */
export const UPLOAD_ROOT = ".data/uploads";

/**
 * Write one uploaded file to the project's evidence folder under a fresh id.
 * The caller inserts the evidence_doc row with the returned id and path. The
 * stored name keeps the original readable but drops anything a path could
 * misuse.
 */
export async function storeUpload(
  file: File,
  projectId: string,
): Promise<{ id: string; filePath: string; size: number }> {
  const dir = join(UPLOAD_ROOT, projectId, "evidence");
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const filePath = join(dir, `${id}-${file.name.replace(/[^\w.\-() ]+/g, "_")}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buf);
  return { id, filePath, size: buf.length };
}
