import type { TierThreshold } from "@/lib/tiers";
import { AutoSaveSelect } from "./AutoSaveSelect";

/** Pick the rating level a project is pursuing; saves on change. */
export function TargetTierForm({
  projectId,
  thresholds,
  current,
  action,
}: {
  projectId: string;
  thresholds: TierThreshold[];
  current: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <AutoSaveSelect
      id="targetTier"
      label="Target level"
      name="targetTier"
      value={current ?? ""}
      options={[
        { value: "", label: "Not set" },
        ...thresholds.map((t) => ({ value: t.tier, label: `${t.tier} · ${t.min}+ pts` })),
      ]}
      fields={{ projectId }}
      action={action}
    />
  );
}
