/**
 * Certificate expiry (D7): a certificate or test report older than the
 * project's window (3 years by default) is expired and no longer counts.
 * Dates are plain YYYY-MM-DD strings, compared as calendar dates.
 */

export const EXPIRY_WARNING_DAYS = 30;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A valid YYYY-MM-DD date, or null. Rejects 2024-02-30 and the like. */
export function parseIsoDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const m = ISO.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s ? s : null;
}

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  // 29 Feb + n years lands on 1 Mar in a non-leap year, which is what Date does.
  return new Date(Date.UTC(y + years, m - 1, d)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type ExpiryState = "valid" | "expiring" | "expired";

export interface Expiry {
  state: ExpiryState;
  /** The first day it no longer counts. */
  expiresOn: string;
  /** Days from `on` until it expires (negative once expired). */
  daysLeft: number;
}

/** Where a document issued on `issuedOn` stands on day `on`. */
export function expiryOf(issuedOn: string, years: number, on: string): Expiry {
  const expiresOn = addYears(issuedOn, years);
  const daysLeft = daysBetween(on, expiresOn);
  const state: ExpiryState = daysLeft <= 0 ? "expired" : daysLeft <= EXPIRY_WARNING_DAYS ? "expiring" : "valid";
  return { state, expiresOn, daysLeft };
}

/** Today as YYYY-MM-DD in Saudi time (UTC+3, no daylight saving). */
export function todayIso(now = new Date()): string {
  return new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

/** The last day of a YYYY-MM month. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function parseMonth(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : null;
}
