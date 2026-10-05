import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../_components/PageChrome";
import { ProjectTabs } from "./_components/ProjectTabs";
import { Card, KpiTile, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { CreditsIcon, FileIcon, UploadIcon } from "@/components/icons";
import { getProject, getProjectCredits, getProjectOverview } from "@/lib/data";
import { TierGauge } from "@/components/ProgressDial";
import { formatSpan } from "@/lib/tiers";
import { setProjectTargetTier } from "../actions";
import { TargetTierForm } from "./_components/TargetTierForm";

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
              href={`/projects/${id}/credits`}
            />
            <KpiTile
              label="Completed"
              value={overview.completed}
              hint="all requirements satisfied"
              tone="emerald"
              icon={<CreditsIcon width={18} height={18} />}
              href={`/projects/${id}/credits?filter=completed`}
            />
            <KpiTile
              label="In Progress"
              value={overview.inProgress}
              hint="partially satisfied"
              tone="amber"
              icon={<CreditsIcon width={18} height={18} />}
              href={`/projects/${id}/credits?filter=in_progress`}
            />
            <KpiTile
              label="Missing Evidence"
              value={overview.missingEvidence}
              hint={`${overview.evidenceFiles} files attached`}
              tone="red"
              icon={<FileIcon width={18} height={18} />}
              href={`/projects/${id}/credits?filter=missing_evidence`}
            />
          </div>

          <CertificationProgress
            projectId={id}
            score={overview.score}
            targetedCredits={credits.filter((c) => c.targeted).length}
            totalCredits={credits.length}
          />

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

/** The project dial (V2 feedback row 11): points against rating levels. */
function CertificationProgress({
  projectId,
  score,
  targetedCredits,
  totalCredits,
}: {
  projectId: string;
  score: Awaited<ReturnType<typeof getProjectOverview>>["score"];
  targetedCredits: number;
  totalCredits: number;
}) {
  const { earned, thresholds, target, reached, byPoints, keystones } = score;
  const toGo = target ? Math.max(0, target.min - earned) : null;
  const keystonesOpen = keystones.total - keystones.complete;

  return (
    <Card className="mt-6 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Certification progress
        </h2>
        {thresholds.length > 0 ? (
          <TargetTierForm
            projectId={projectId}
            thresholds={thresholds}
            current={target?.tier ?? null}
            action={setProjectTargetTier}
          />
        ) : null}
      </div>

      {thresholds.length === 0 ? (
        <p className="text-sm text-slate-500">
          {earned} points earned. Rating levels are not set for this rating
          system yet. Add them in{" "}
          <Link href="/admin/catalog" className="font-medium text-brand-600 hover:text-brand-700">
            Catalog
          </Link>{" "}
          to see progress toward a certification level.
        </p>
      ) : (
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
          <TierGauge
            earned={earned}
            scaleMax={score.scaleMax}
            thresholds={thresholds}
            target={target}
            reached={reached}
          />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Target</dt>
              <dd className="font-medium text-slate-900">
                {target ? (
                  toGo === 0 ? (
                    <span className="text-emerald-700">
                      {target.tier} — points threshold met
                    </span>
                  ) : (
                    <>
                      {target.tier} at {target.min} pts ·{" "}
                      <span className="text-brand-700">{toGo} to go</span>
                    </>
                  )
                ) : (
                  <span className="text-slate-500">Not set</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Targeted credits</dt>
              <dd className="font-medium text-slate-900">
                {formatSpan(score.targeted)} pts · {targetedCredits} of {totalCredits} credits
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Level reached</dt>
              <dd className="font-medium text-slate-900">
                {reached?.tier ??
                  (byPoints ? `None yet (points reach ${byPoints.tier})` : "None yet")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Keystone credits</dt>
              <dd className="font-medium text-slate-900">
                {keystones.complete} of {keystones.total} complete
              </dd>
            </div>
            {keystonesOpen > 0 ? (
              <p className="text-xs text-amber-700 sm:col-span-2">
                No level is awarded until all {keystones.total} keystone credits
                are achieved, whatever the points total (Mostadam §2.5).
              </p>
            ) : null}
          </dl>
        </div>
      )}
    </Card>
  );
}
