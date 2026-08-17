import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../_components/PageChrome";
import { ProjectTabs } from "../_components/ProjectTabs";
import { KpiTile, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { CreditsIcon, UploadIcon } from "@/components/icons";
import { getProject, getProjectCredits } from "@/lib/data";
import { CreditsTable, type CreditRow } from "./CreditsTable";

export default async function CreditsPage({
  params,
}: PageProps<"/projects/[id]/credits">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const credits = await getProjectCredits(id);
  const rows: CreditRow[] = credits.map((c) => ({
    code: c.code,
    title: c.title,
    categoryCode: c.categoryCode,
    categoryName: c.categoryName,
    isKeystone: c.isKeystone,
    requirementCount: c.requirements.length,
    status: c.status,
    pointsEarned: c.pointsEarned,
    pointsMax: c.pointsMax,
    pointsMin: c.pointsMin,
  }));

  const completed = rows.filter((r) => r.status === "completed").length;
  const inProgress = rows.filter((r) => r.status === "in_progress").length;
  const notStarted = rows.filter((r) => r.status === "not_started").length;

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Credits" },
      ]}
    >
      <PageHeader
        title="Credit Management"
        subtitle={`${project.name} · Mostadam`}
      />
      <ProjectTabs projectId={id} />

      {rows.length === 0 ? (
        <EmptyState
          title="No confirmed credits"
          description="Upload a Mostadam manual and confirm the extracted draft first."
          icon={<UploadIcon width={28} height={28} />}
          action={
            <Link
              href={`/projects/${id}/documents`}
              className={primaryButtonClass}
            >
              <UploadIcon width={16} height={16} /> Upload a manual
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiTile
              label="Total Credits"
              value={rows.length}
              icon={<CreditsIcon width={18} height={18} />}
            />
            <KpiTile label="Completed" value={completed} tone="emerald" />
            <KpiTile label="In Progress" value={inProgress} tone="amber" />
            <KpiTile label="Not Started" value={notStarted} tone="slate" />
          </div>
          <CreditsTable projectId={id} credits={rows} />
        </>
      )}
    </PageChrome>
  );
}
