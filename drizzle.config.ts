import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./db/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: databaseUrl(),
  },
});
