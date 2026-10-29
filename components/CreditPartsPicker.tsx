import { TagPicker } from "@/components/TagPicker";
import { CREDIT_PARTS } from "@/lib/materials/parts";

const OPTIONS = CREDIT_PARTS.map((p) => ({
  value: p.key,
  code: p.creditCode,
  label: p.label,
  hint: p.interiorOnly ? "interior only" : undefined,
}));

/** The credit calculations a material type or product is counted in, picked as tags (D33). */
export function CreditPartsPicker({ defaultValue, label }: { defaultValue: string[]; label: string }) {
  return (
    <TagPicker
      name="parts"
      options={OPTIONS}
      defaultValue={defaultValue}
      label={label}
      placeholder="Type a credit, e.g. MW-05 or steel"
      noMatch="No credit calculation matches"
    />
  );
}
