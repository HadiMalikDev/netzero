import { describe } from "vitest";
import { loadDotEnv } from "@/db/env";

export function isPostgresUrl(url?: string): boolean {
  loadDotEnv();
  const u = url ?? process.env.DATABASE_URL?.trim() ?? "";
  return u.startsWith("postgres://") || u.startsWith("postgresql://");
}

export function describeDb(name: string, fn: () => void) {
  if (process.env.SKIP_DB_TESTS === "1") return describe.skip(name, fn);
  return describe(name, fn);
}
