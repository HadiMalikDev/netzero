import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../_components/PageChrome";
import { ProjectTabs } from "./_components/ProjectTabs";
import { Card, KpiTile, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { CreditsIcon, FileIcon, UploadIcon } from "@/components/icons";
import { getProject, getProjectCredits, getProjectOverview } from "@/lib/data";

export default async function ProjectOverviewPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const overview = await getProjectOverview(id);
  const credits = await getProjectCredits(id);

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Overview" },
      ]}
    >
      <PageHeader
        title={project.name}
        subtitle={
          [project.type, project.location].filter(Boolean).join(" · ") ||
          "Mostadam certification tracking"
        }
      />
      <ProjectTabs projectId={id} />

      {overview.totalCredits === 0 ? (
        <EmptyState
          title="No confirmed credits yet"
          description="Upload a Mostadam manual and confirm the extracted draft to build this project's live checklist."
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiTile
              label="Total Credits"
              value={overview.totalCredits}
              hint={`${overview.categories.length} categories`}
              icon={<CreditsIcon width={18} height={18} />}
            />
            <KpiTile
              label="Completed"
              value={overview.completed}
              hint="all requirements satisfied"
              tone="emerald"
              icon={<CreditsIcon width={18} height={18} />}
            />
            <KpiTile
              label="In Progress"
              value={overview.inProgress}
              hint="partially satisfied"
              tone="amber"
              icon={<CreditsIcon width={18} height={18} />}
            />
            <KpiTile
              label="Missing Evidence"
              value={overview.missingEvidence}
              hint={`${overview.evidenceFiles} files attached`}
              tone="red"
              icon={<FileIcon width={18} height={18} />}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-800">
                Credits by Category
              </h2>
              <ul className="space-y-3">
                {overview.categories.map((c) => (
                  <li key={c.code} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-center text-xs font-semibold text-slate-600">
                      {c.code}
                    </span>
                    <span className="flex-1 text-sm text-slate-700">
                      {c.name}
                    </span>
                    <span className="text-sm font-medium text-slate-500">
                      {c.count}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">
                  Recent Credits
                </h2>
                <Link
                  href={`/projects/${id}/credits`}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View all →
                </Link>
              </div>
              <ul className="divide-y divide-slate-100">
                {credits.slice(0, 6).map((c) => (
                  <li key={c.projectCreditId}>
                    <Link
                      href={`/projects/${id}/credits/${c.code}`}
                      className="flex items-center justify-between py-2.5 hover:opacity-80"
                    >
                      <span className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">
                          {c.code}
                        </span>{" "}
                        {c.title}
                      </span>
                      <StatusPill status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </PageChrome>
  );
}
