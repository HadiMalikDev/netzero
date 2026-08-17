import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome } from "../../../../_components/PageChrome";
import { Card } from "@/components/ui";
import { StatusPill } from "@/components/StatusPill";
import { getCreditByCode, getProject } from "@/lib/data";
import { updateCreditEntries } from "../../../actions";
import { RequirementItem } from "./RequirementItem";
import { SaveCreditButton } from "./SaveCreditButton";
import { groupByOption } from "@/lib/option-group";
import { OptionGroup } from "@/components/OptionGroup";

export default async function CreditDetailPage({
  params,
}: PageProps<"/projects/[id]/credits/[code]">) {
  const { id, code } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const credit = await getCreditByCode(id, decodeURIComponent(code));
  if (!credit) notFound();

  return (
    <PageChrome
      crumbs={[
        { label: "Projects" },
        { label: project.name },
        { label: "Credits" },
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
                {credit.pointsRaw
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

      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">
          Requirements Checklist
        </h2>
        <div>
          {groupByOption(credit.requirements).map((block, i) => {
            const items = block.kind === "xor" ? block.items : [block.item];
            const body = items.map((req) => (
              <RequirementItem
                key={req.entryId}
                req={req}
                projectId={id}
                code={credit.code}
                rsVersionId={project.rsVersionId}
                grouped={block.kind === "xor"}
              />
            ));
            if (block.kind === "xor")
              return (
                <OptionGroup key={`xor-${block.group}-${i}`} count={items.length}>
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
