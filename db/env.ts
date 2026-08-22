import { existsSync, readFileSync } from "node:fs";

/** Load `.env` into process.env when present (tsx / vitest / Railway-without-file). */
export function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const raw of readFileSync(".env", "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i);
    let val = line.slice(i + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    if (process.env[key] == null) process.env[key] = val;
  }
}

export function databaseUrl(): string {
  loadDotEnv();
  const url = process.env.DATABASE_URL?.trim();
  if (!url)
    throw new Error("DATABASE_URL is required (postgres connection string)");
  return url;
}
