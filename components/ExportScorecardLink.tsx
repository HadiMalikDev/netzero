import { primaryButtonClass } from "@/components/ui";

/** Download the project's Excel scorecard (V2 feedback row 8). */
export function ExportScorecardLink({ projectId }: { projectId: string }) {
  return (
    <a
      href={`/api/projects/${projectId}/export`}
      className={primaryButtonClass}
      download
    >
      Export to Excel
    </a>
  );
}
