import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { databaseUrl } from "./env";

const url = databaseUrl();
const client = postgres(url, { max: 1 });

await migrate(drizzle(client), { migrationsFolder: "./db/migrations" });
console.log("migrations applied");
await client.end();
