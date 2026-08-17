import { db } from "./index";
import { users, workspaces } from "./schema";
import { hashPassword } from "../lib/auth/session";
import { eq } from "drizzle-orm";

/**
 * Seeds the single Stage-1 workspace + solo user from env
 * (AUTH_EMAIL / AUTH_PASSWORD). Idempotent.
 */
async function main() {
  const WORKSPACE_ID = "ws_default";
  const USER_ID = "user_solo";
  const email = process.env.AUTH_EMAIL || "admin@netzero.local";
  const password = process.env.AUTH_PASSWORD || "netzero";

  const existingWs = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, WORKSPACE_ID));
  if (existingWs.length === 0) {
    await db
      .insert(workspaces)
      .values({ id: WORKSPACE_ID, name: "NetZero Workspace" });
    console.log("seeded workspace");
  }

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.id, USER_ID));
  if (existingUser.length === 0) {
    await db.insert(users).values({
      id: USER_ID,
      workspaceId: WORKSPACE_ID,
      email,
      name: "Admin",
      passwordHash: hashPassword(password),
    });
    console.log(`seeded user ${email}`);
  } else {
    // Keep credentials in sync with env on re-seed.
    await db
      .update(users)
      .set({ email, passwordHash: hashPassword(password) })
      .where(eq(users.id, USER_ID));
    console.log(`updated user ${email}`);
  }

  console.log("seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
