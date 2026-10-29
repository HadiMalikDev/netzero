/** A quantity as printed in the tables: up to 2 decimals, thousands separated; "—" when not entered. */
export function formatQty(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** A share as "62.5%"; "—" when there is nothing to divide by. */
export function formatPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}
