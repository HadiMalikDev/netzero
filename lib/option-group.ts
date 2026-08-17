export type OptionBlock<T> =
  | { kind: "single"; item: T }
  | { kind: "xor"; group: string; items: T[] };

/** Consecutive items sharing a non-null optionGroup become one XOR block. */
export function groupByOption<T extends { optionGroup?: string | null }>(
  items: T[],
): OptionBlock<T>[] {
  const out: OptionBlock<T>[] = [];
  for (const item of items) {
    const g = item.optionGroup?.trim() || null;
    const last = out[out.length - 1];
    if (g && last?.kind === "xor" && last.group === g) {
      last.items.push(item);
      continue;
    }
    if (g) out.push({ kind: "xor", group: g, items: [item] });
    else out.push({ kind: "single", item });
  }
  return out;
}
