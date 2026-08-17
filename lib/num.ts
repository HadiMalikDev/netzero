/** Parse a stored/raw string into a finite number, or null when absent/invalid. */
export function parseNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
