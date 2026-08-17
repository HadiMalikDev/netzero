import Link from "next/link";
import { PageChrome, PageHeader } from "../_components/PageChrome";
import { Card, KpiTile } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import {
  CreditsIcon,
  FileIcon,
  PlusIcon,
  ProjectsIcon,
} from "@/components/icons";
import { getProjectOverview, listProjects } from "@/lib/data";

export default async function DashboardPage() {
  const projects = await listProjects();
  const overviews = await Promise.all(
    projects.map(async (p) => ({
      project: p,
      overview: await getProjectOverview(p.id),
    })),
  );

  const totals = overviews.reduce(
    (acc, { overview }) => {
      acc.credits += overview.totalCredits;
      acc.completed += overview.completed;
      acc.inProgress += overview.inProgress;
      acc.missingEvidence += overview.missingEvidence;
      return acc;
    },
    { credits: 0, completed: 0, inProgress: 0, missingEvidence: 0 },
  );

  return (
    <PageChrome crumbs={[{ label: "Home" }, { label: "Dashboard" }]}>
      <PageHeader
        title="Dashboard"
        subtitle="Real counts across your projects — no placeholder metrics."
        action={
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <PlusIcon width={16} height={16} /> New Project
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project and upload a Mostadam manual to extract its credits into a live checklist."
          icon={<ProjectsIcon width={28} height={28} />}
          action={
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <PlusIcon width={16} height={16} /> Create your first project
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Active Projects"
              value={projects.length}
              hint={`${projects.length} in this workspace`}
              icon={<ProjectsIcon width={18} height={18} />}
              tone="brand"
            />
            <KpiTile
              label="Credits Completed"
              value={totals.completed}
              hint={`of ${totals.credits} confirmed credits`}
              icon={<CreditsIcon width={18} height={18} />}
              tone="emerald"
            />
            <KpiTile
              label="In Progress"
              value={totals.inProgress}
              hint="credits partially satisfied"
              icon={<CreditsIcon width={18} height={18} />}
              tone="amber"
            />
            <KpiTile
              label="Missing Evidence"
              value={totals.missingEvidence}
              hint="requirements awaiting a file"
              icon={<FileIcon width={18} height={18} />}
              tone="red"
            />
          </div>

          <Card className="mt-6">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Projects</h2>
              <Link
                href="/projects"
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {overviews.map(({ project, overview }) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {project.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {project.location || "—"} ·{" "}
                        {overview.totalCredits} credits · {overview.evidenceFiles}{" "}
                        evidence file{overview.evidenceFiles === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {overview.completed}/{overview.totalCredits} done
                      </span>
                      <StatusPill
                        status={
                          overview.totalCredits === 0
                            ? "not_started"
                            : overview.completed === overview.totalCredits
                              ? "completed"
                              : "in_progress"
                        }
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </PageChrome>
  );
}
