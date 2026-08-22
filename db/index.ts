import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl } from "./env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __pg?: ReturnType<typeof postgres>;
  __db?: ReturnType<typeof makeDb>;
};

function makeDb() {
  const sql =
    globalForDb.__pg ??
    postgres(databaseUrl(), {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  if (process.env.NODE_ENV !== "production") globalForDb.__pg = sql;
  return drizzle(sql, { schema });
}

/** Lazy so importing this module does not require DATABASE_URL (unit tests). */
export const db = new Proxy({} as ReturnType<typeof makeDb>, {
  get(_target, prop, receiver) {
    const real = (globalForDb.__db ??= makeDb());
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
