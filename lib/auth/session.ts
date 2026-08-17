import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const COOKIE = "nz_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret";
}

// --- password hashing (scrypt, salt stored alongside) ---

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    timingSafeEqual(candidate, expected)
  );
}

// --- signed session token (userId.expiry.hmac) ---

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function makeToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, mac] = parts;
  const payload = `${userId}.${exp}`;
  const good = sign(payload);
  if (
    mac.length !== good.length ||
    !timingSafeEqual(Buffer.from(mac), Buffer.from(good))
  ) {
    return null;
  }
  if (Number(exp) * 1000 < Date.now()) return null;
  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** The signed-in user, or null. There is exactly one user in Stage 1. */
export async function currentUser() {
  const store = await cookies();
  const userId = readToken(store.get(COOKIE)?.value);
  if (!userId) return null;
  const rows = await db.select().from(users).where(eq(users.id, userId));
  return rows[0] ?? null;
}

/** Like currentUser but redirects to /login when signed out. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
