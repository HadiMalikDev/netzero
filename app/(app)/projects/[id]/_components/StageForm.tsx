import type { ProjectStage } from "@/lib/evidence";
import { AutoSaveSelect } from "./AutoSaveSelect";

/**
 * The project's stage; saves on change. It decides which listed documents are
 * due, so changing it can move credits back to In Progress.
 */
export function StageForm({
  projectId,
  stage,
  action,
}: {
  projectId: string;
  stage: ProjectStage;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <AutoSaveSelect
      id="stage"
      label="Stage"
      name="stage"
      value={stage}
      options={[
        { value: "design", label: "Design" },
        { value: "construction", label: "Construction" },
      ]}
      fields={{ projectId }}
      action={action}
    />
  );
}
