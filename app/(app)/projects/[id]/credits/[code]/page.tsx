import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome } from "../../../../_components/PageChrome";
import { Card } from "@/components/ui";
import { StatusPill } from "@/components/StatusPill";
import { getCreditByCode, getProject } from "@/lib/data";
import {
  deleteEvidence,
  rerunEvidenceReview,
  resetPath,
  updateCreditEntries,
  uploadEvidence,
} from "../../../actions";
import { RequirementItem } from "./RequirementItem";
import {
  RequiredDocuments,
  type DocSection,
} from "@/components/EvidenceChecklist";
import { documentScope } from "@/lib/evidence";
import { SaveCreditButton } from "./SaveCreditButton";
import { groupByOption, pathStates, type PathState } from "@/lib/option-group";
import { OptionGroup } from "@/components/OptionGroup";
import { formatPointsSpan } from "@/lib/points";

export default async function CreditDetailPage({
  params,
}: PageProps<"/projects/[id]/credits/[code]">) {
  const { id, code } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const credit = await getCreditByCode(id, decodeURIComponent(code));
  if (!credit) notFound();

  // Path state of each requirement (either/or options only), shared by the
  // Required documents box and the checklist below it.
  const paths = new Map<string, PathState>();
  for (const block of groupByOption(credit.requirements)) {
    if (block.kind !== "xor") continue;
    pathStates(block.items).forEach((p, i) => paths.set(block.items[i].entryId, p));
  }
  const sections: DocSection[] = [];
  const setAside: typeof credit.requirements = [];
  for (const req of credit.requirements) {
    const scope = documentScope(req, paths.get(req.entryId));
    if (scope.show) sections.push({ req, counted: scope.counted, tag: scope.tag });
    else setAside.push(req);
  }

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Credits", href: `/projects/${id}/credits` },
        { label: credit.code },
      ]}
    >
      <div className="mb-6">
        <Link
          href={`/projects/${id}/credits`}
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          ← Back to credits
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {credit.categoryCode} · {credit.categoryName}
              </span>
              {credit.isKeystone ? (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  Keystone
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {credit.code} — {credit.title}
            </h1>
            {credit.pageStart ? (
              <p className="mt-1 text-sm text-slate-400">
                Source: manual pp.{credit.pageStart}–{credit.pageEnd}
                {credit.pointsMax != null
                  ? ` · ${credit.pointsEarned} / ${
                      credit.pointsMin != null &&
                      credit.pointsMin !== credit.pointsMax
                        ? formatPointsSpan(credit.pointsMin, credit.pointsMax)
                        : credit.pointsMax
                    } points`
                  : credit.pointsRaw
                    ? ` · ${credit.pointsRaw} points (reference)`
                    : ""}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusPill status={credit.status} />
            {/* Single per-credit Save form; requirement inputs bind via
                form="save-credit". */}
            <form id="save-credit" action={updateCreditEntries}>
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="code" value={credit.code} />
              <SaveCreditButton />
            </form>
          </div>
        </div>
      </div>

      {credit.aim ? (
        <Card className="mb-6 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Aim</h2>
          <p className="text-sm text-slate-600">{credit.aim}</p>
        </Card>
      ) : null}

      <Card className="mb-6 overflow-hidden">
        <RequiredDocuments
          sections={sections}
          setAside={setAside}
          projectId={id}
          code={credit.code}
          uploadAction={uploadEvidence}
          deleteAction={deleteEvidence}
          rerunAction={rerunEvidenceReview}
        />
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">
          Requirements Checklist
        </h2>
        <div>
          {groupByOption(credit.requirements).map((block, i) => {
            const items = block.kind === "xor" ? block.items : [block.item];
            const chosen = items.find((r) => paths.get(r.entryId) === "chosen");
            const body = items.map((req) => (
              <RequirementItem
                key={req.entryId}
                req={req}
                rsVersionId={project.rsVersionId}
                grouped={block.kind === "xor"}
                path={paths.get(req.entryId)}
              />
            ));
            if (block.kind === "xor")
              return (
                <OptionGroup
                  key={`xor-${block.group}-${i}`}
                  count={items.length}
                  chosenSeq={chosen?.seq}
                  resetEntryId={items[0].entryId}
                  resetAction={resetPath}
                  form="save-credit"
                >
                  {body}
                </OptionGroup>
              );
            return <div key={items[0].entryId}>{body}</div>;
          })}
        </div>
      </Card>
    </PageChrome>
  );
}
