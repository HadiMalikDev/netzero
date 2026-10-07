import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../../../_components/PageChrome";
import { Button, Card } from "@/components/ui";
import { getCreditByCode, getProject } from "@/lib/data";
import { getInspection, type Answer, type ResponseRow } from "@/lib/checklists";
import { formatUploadedAt } from "@/lib/format";
import { rerunDraftAction, saveInspectionAction } from "../../../../../inspection-actions";

/**
 * Review one inspection (Sprint 2 item 3). Every item shows the AI's
 * suggestion and the plan sentence behind it, pre-selected; the reviewer keeps
 * or overrides each answer, adds remarks, and saves. Only saved answers print.
 */

const CHOICES: { value: Answer | ""; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "na", label: "N/A" },
  { value: "", label: "—" },
];

const AI_LABEL: Record<Answer, string> = { yes: "AI: Yes", no: "AI: No", na: "AI: N/A" };

function Row({ r }: { r: ResponseRow }) {
  const overridden = r.aiAnswer != null && r.answer !== r.aiAnswer;
  return (
    <tr className="align-top">
      <td className="w-14 bg-slate-600 px-3 py-3 text-center text-xs font-semibold text-white">{r.itemNo}</td>
      <td className="px-4 py-3">
        <div className="text-sm text-slate-800">{r.itemText}</div>
        {r.aiAnswer ? (
          <div className="mt-1.5 rounded-md border border-brand-100 bg-brand-50/60 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
              {AI_LABEL[r.aiAnswer]}
              {overridden ? " · overridden" : ""}
            </span>
            {r.aiQuote ? <p className="mt-0.5 text-xs italic text-slate-600">“{r.aiQuote}”</p> : null}
          </div>
        ) : null}
      </td>
      <td className="w-60 px-4 py-3">
        <div className="flex gap-1">
          {CHOICES.map((c) => (
            <label
              key={c.value || "blank"}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-700"
            >
              <input
                type="radio"
                name={`answer:${r.id}`}
                value={c.value}
                defaultChecked={(r.answer ?? "") === c.value}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </td>
      <td className="w-64 px-4 py-3">
        <input name={`remark:${r.id}`} defaultValue={r.remark ?? ""} placeholder="Remark" className="input" />
      </td>
    </tr>
  );
}

export default async function InspectionReviewPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]/credits/[code]/inspections/[inspectionId]">) {
  const { id, code: rawCode, inspectionId } = await params;
  const saved = (await searchParams)?.saved === "1";
  const code = decodeURIComponent(rawCode);
  const project = await getProject(id);
  if (!project) notFound();
  const credit = await getCreditByCode(id, code);
  if (!credit) notFound();
  const insp = await getInspection(inspectionId);
  if (!insp || insp.projectCreditId !== credit.projectCreditId) notFound();

  const base = `/projects/${id}/credits/${encodeURIComponent(code)}/inspections`;
  const sections: { no: string; heading: string; rows: ResponseRow[] }[] = [];
  for (const r of insp.responses) {
    const last = sections[sections.length - 1];
    if (last?.no === r.sectionNo) last.rows.push(r);
    else sections.push({ no: r.sectionNo, heading: r.sectionHeading, rows: [r] });
  }
  const suggested = insp.responses.filter((r) => r.aiAnswer).length;
  const sources: string[] = insp.aiState === "done" && insp.aiNote ? JSON.parse(insp.aiNote) : [];
  const hidden = (
    <>
      <input type="hidden" name="projectId" value={id} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="inspectionId" value={insp.id} />
    </>
  );

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: credit.code, href: `/projects/${id}/credits/${encodeURIComponent(code)}` },
        { label: "Inspections", href: base },
        { label: insp.inspectionDate ?? "Draft" },
      ]}
    >
      <PageHeader
        title={insp.template.title}
        subtitle={`${project.name} · ${credit.code} ${credit.title}`}
        action={
          insp.reviewedAt ? (
            <a href={`/api/projects/${id}/credits/${encodeURIComponent(code)}/inspections/${insp.id}/pdf`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" download>
              Download PDF
            </a>
          ) : (
            <span className="text-sm text-slate-500">Save your review to download the PDF</span>
          )
        }
      />

      {saved ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Saved. These answers are what the PDF prints.
        </div>
      ) : null}

      <Card className="mb-4 px-5 py-4 text-sm">
        {insp.aiState === "pending" ? (
          <div className="flex items-center gap-2 text-slate-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            The AI is reading the uploaded plan and drafting answers (about 15 seconds).{" "}
            <Link href={`${base}/${insp.id}`} className="font-medium text-brand-600 hover:text-brand-700">
              Refresh
            </Link>{" "}
            to see them. You can start reviewing now; your saved answers are never overwritten.
          </div>
        ) : insp.aiState === "done" ? (
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span>
              AI suggested answers for <strong>{suggested}</strong> of {insp.responses.length} items from{" "}
              {sources.join(", ") || "the uploaded plan"}. It suggests Yes or N/A only with a sentence from the plan, and never No; the rest is yours to answer.
            </span>
            <form action={rerunDraftAction} className="ml-auto">
              {hidden}
              <button type="submit" className="text-xs font-medium text-slate-500 hover:text-slate-700">Re-run AI</button>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span>
              No AI suggestions: {insp.aiNote ?? "the draft did not run"}. Answer the items yourself, or upload the plan to the credit and re-run.
            </span>
            <form action={rerunDraftAction} className="ml-auto">
              {hidden}
              <button type="submit" className="text-xs font-medium text-brand-600 hover:text-brand-700">Re-run AI</button>
            </form>
          </div>
        )}
      </Card>

      <form action={saveInspectionAction}>
        {hidden}
        <Card className="mb-4 grid gap-4 px-5 py-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Inspection date
            <input type="date" name="inspectionDate" defaultValue={insp.inspectionDate ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Inspector
            <input name="inspector" defaultValue={insp.inspector ?? ""} className="input mt-1" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Area / level
            <input name="area" defaultValue={insp.area ?? ""} className="input mt-1" />
          </label>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-200 text-left text-xs font-semibold text-slate-700">
              <tr>
                <th className="px-3 py-2 text-center">No</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Answer</th>
                <th className="px-4 py-2">Remarks</th>
              </tr>
            </thead>
            {sections.map((s) => (
              <tbody key={s.no} className="divide-y divide-slate-100 border-t border-slate-200">
                <tr className="bg-slate-100">
                  <td className="bg-slate-600 px-3 py-2 text-center text-xs font-semibold text-white">{s.no}</td>
                  <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-slate-800">{s.heading}</td>
                </tr>
                {s.rows.map((r) => (
                  <Row key={r.id} r={r} />
                ))}
              </tbody>
            ))}
          </table>
        </Card>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {insp.reviewedAt
              ? `Last reviewed by ${insp.reviewedByName ?? "—"} on ${formatUploadedAt(insp.reviewedAt)}.`
              : "Not reviewed yet. Saving confirms every answer above under your name."}
          </p>
          <Button type="submit">Save review</Button>
        </div>
      </form>
    </PageChrome>
  );
}
