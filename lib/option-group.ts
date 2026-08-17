export type Optioned = { optionGroup?: string | null };

export type OptionBlock<T> =
  | { kind: "single"; item: T }
  | { kind: "xor"; group: string; items: T[] };

/** Consecutive items sharing a non-null optionGroup become one XOR block. */
export function groupByOption<T extends Optioned>(items: T[]): OptionBlock<T>[] {
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

/** Map each slot: XOR block → `xor(items)`, ungrouped row → `single(item)`. */
export function mapByOption<T extends Optioned, R>(
  items: T[],
  xor: (items: T[]) => R,
  single: (item: T) => R,
): R[] {
  return groupByOption(items).map((block) =>
    block.kind === "xor" ? xor(block.items) : single(block.item),
  );
}

/** XOR slots contribute MAX; ungrouped rows add. */
export function reduceByOption<T extends Optioned>(
  items: T[],
  value: (item: T) => number,
): number {
  let sum = 0;
  for (const n of mapByOption(
    items,
    (xs) => Math.max(0, ...xs.map(value)),
    value,
  ))
    sum += n;
  return sum;
}
