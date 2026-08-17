import Link from "next/link";
import { PageChrome, PageHeader } from "../_components/PageChrome";
import { Card, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { PlusIcon, ProjectsIcon } from "@/components/icons";
import { getProjectOverview, listProjects } from "@/lib/data";

export default async function ProjectsPage() {
  const projects = await listProjects();
  const withOverview = await Promise.all(
    projects.map(async (p) => ({ p, o: await getProjectOverview(p.id) })),
  );

  return (
    <PageChrome
      crumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Projects" },
      ]}
    >
      <PageHeader
        title="Projects"
        subtitle="Each project tracks one or more Mostadam manuals."
        action={
          <Link
            href="/projects/new"
            className={primaryButtonClass}
          >
            <PlusIcon width={16} height={16} /> New Project
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project and upload a Mostadam manual to extract its credits."
          icon={<ProjectsIcon width={28} height={28} />}
          action={
            <Link
              href="/projects/new"
              className={primaryButtonClass}
            >
              <PlusIcon width={16} height={16} /> Create your first project
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {withOverview.map(({ p, o }) => {
            const pct =
              o.totalCredits === 0
                ? 0
                : Math.round((o.completed / o.totalCredits) * 100);
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      MOSTADAM
                    </span>
                    <StatusPill
                      status={
                        o.totalCredits === 0
                          ? "not_started"
                          : o.completed === o.totalCredits
                            ? "completed"
                            : "in_progress"
                      }
                    />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    {p.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {[p.type, p.location].filter(Boolean).join(" · ") || "—"}
                  </p>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Credits completed</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-4 text-sm text-slate-500">
                    <span>{o.completed} done</span>
                    <span>{o.inProgress} active</span>
                    <span>{o.notStarted} open</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </PageChrome>
  );
}
