import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../_components/PageChrome";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Card } from "@/components/ui";
import { getProject } from "@/lib/data";
import { CREDIT_PARTS, partByKey } from "@/lib/materials/parts";
import {
  ensureProjectSmq,
  getSmq,
  projectCreditsByCode,
  ROW_KIND_LABEL,
  ROW_KINDS,
  type SmqRowView,
} from "@/lib/materials/smq";
import {
  addSmqRowAction,
  addSmqSectionAction,
  editSmqRowAction,
  editSmqSectionAction,
  saveSmqSettingsAction,
} from "../../../material-actions";

/**
 * Edit the project's Sustainability Material Questionnaire (Sprint 3, D1):
 * its own copy of the standard SMQ, made on first visit. Material types and
 * rows can be renamed, reordered, added and switched off; each row's credit,
 * kind and project target can be set. Products already entered keep the
 * wording they were filled with. Plain forms, so each change saves on its own.
 */

const small =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40";
const fieldLabel = "text-xs font-medium text-slate-600";

function RowFields({
  row,
  credits,
}: {
  row?: SmqRowView;
  credits: { id: string; code: string; title: string }[];
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label className={`${fieldLabel} md:col-span-2`}>
        Required documents / parameters
        <textarea name="text" defaultValue={row?.text ?? ""} rows={3} className="input mt-1 text-sm" required />
      </label>
      <label className={fieldLabel}>
        Mostadam credit
        <select name="projectCreditId" defaultValue={row?.projectCreditId ?? ""} className="input mt-1 text-sm">
          <option value="">None (LEED only, or not linked)</option>
          {credits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.title}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabel}>
        LEED reference (shown only, never counted)
        <input name="leedRef" defaultValue={row?.leedRef ?? ""} className="input mt-1 text-sm" />
      </label>
      <label className={fieldLabel}>
        Kind
        <select name="kind" defaultValue={row?.kind ?? "fixed"} className="input mt-1 text-sm">
          {ROW_KINDS.map((k) => (
            <option key={k} value={k}>
              {ROW_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabel}>
        Value unit (optional)
        <input name="valueUnit" defaultValue={row?.valueUnit ?? ""} placeholder="g/L, %, W/m²K" className="input mt-1 text-sm" />
      </label>
      <label className={fieldLabel}>
        Project target (shown beside the answer)
        <textarea name="targetText" defaultValue={row?.targetText ?? ""} rows={2} className="input mt-1 text-sm" />
      </label>
      <label className={fieldLabel}>
        Note
        <textarea name="note" defaultValue={row?.note ?? ""} rows={2} className="input mt-1 text-sm" />
      </label>
    </div>
  );
}

function CreditTag({ row }: { row: SmqRowView }) {
  if (row.credit) return <Badge tone="brand">{row.credit.code}</Badge>;
  if (row.creditCode)
    return (
      <span title="This project's catalog has no credit with this code. Pick one under Edit.">
        <Badge tone="amber">{row.creditCode} · unlinked</Badge>
      </span>
    );
  return <Badge>LEED only</Badge>;
}

export default async function MaterialFormPage({ params }: PageProps<"/projects/[id]/materials/form">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const template = await ensureProjectSmq(id);
  if (!template) notFound();
  const smq = await getSmq(template.id);
  if (!smq) notFound();
  const credits = [...(await projectCreditsByCode(id)).entries()]
    .map(([code, c]) => ({ id: c.id, code, title: c.title }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const base = `/projects/${id}/materials`;
  const ids = <input type="hidden" name="projectId" value={id} />;
  const types = smq.sections.filter((s) => s.kind === "material_type");
  const unlinked = smq.sections.flatMap((s) => s.rows).filter((r) => r.active && r.creditCode && !r.projectCreditId);

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Materials", href: base },
        { label: "Questionnaire" },
      ]}
    >
      <PageHeader
        title="Material questionnaire"
        subtitle={`${project.name} · this project's own copy of the SMQ (${template.revision ?? "standard"}): ${types.filter((t) => t.active).length} material types in use. Changes apply to products added from now on; products already entered keep the wording they were filled with.`}
        action={
          <Link href={base} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Materials
          </Link>
        }
      />

      <Card className="mb-6 px-5 py-4">
        <ActionForm id="settings" action={saveSmqSettingsAction} className="grid gap-3 md:grid-cols-3">
          {ids}
          <label className="text-sm font-medium text-slate-700 md:col-span-3">
            Questionnaire title
            <input name="title" defaultValue={smq.template.title} required className="input mt-1" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Certificates expire after (years)
            <input name="expiryYears" type="number" min={1} max={50} defaultValue={smq.template.expiryYears} className="input mt-1" />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Total construction material cost from the BOQ (SAR), for RC-01
            <input
              name="boqMaterialCostSar"
              inputMode="decimal"
              defaultValue={smq.template.boqMaterialCostSar ?? ""}
              placeholder="Not entered"
              className="input mt-1"
            />
          </label>
          <div className="md:col-span-3">
            <button type="submit" className={small}>Save settings</button>
          </div>
        </ActionForm>
      </Card>

      {unlinked.length ? (
        <Card className="mb-6 border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          {unlinked.length} row{unlinked.length === 1 ? "" : "s"} name a credit this project&apos;s catalog does not have (
          {[...new Set(unlinked.map((r) => r.creditCode))].join(", ")}). They don&apos;t count toward any credit until a credit is picked.
        </Card>
      ) : null}

      <div className="space-y-3">
        {smq.sections.map((s) => {
          const isAll = s.kind === "all_materials";
          const typeIndex = types.findIndex((t) => t.id === s.id);
          const inUse = s.rows.filter((r) => r.active).length;
          return (
            <Card key={s.id} className={`overflow-hidden ${s.active ? "" : "opacity-70"}`}>
              <details id={`s-${s.id}`} open={isAll}>
                <summary className="flex cursor-pointer items-center gap-3 bg-slate-100 px-4 py-2.5">
                  <span className="flex-1 text-sm font-semibold text-slate-800">
                    {s.heading}
                    {s.active ? null : <span className="ml-2 font-normal text-slate-500">(switched off)</span>}
                  </span>
                  {s.defaultParts.map((k) => {
                    const p = partByKey(k);
                    return (
                      <Badge key={k} tone="brand">
                        {p ? `${p.creditCode} ${p.label}` : k}
                      </Badge>
                    );
                  })}
                  <span className="text-xs text-slate-500">
                    {inUse} row{inUse === 1 ? "" : "s"}
                  </span>
                </summary>

                <div className="space-y-2 border-b border-slate-100 px-4 py-3">
                  <ActionForm action={editSmqSectionAction} className="flex flex-wrap items-center gap-2">
                    {ids}
                    <input type="hidden" name="sectionId" value={s.id} />
                    <input name="heading" defaultValue={s.heading} required className="input flex-1 text-sm font-semibold" />
                    <button type="submit" name="op" value="rename" className={small}>Rename</button>
                    {isAll ? null : (
                      <>
                        <button type="submit" name="op" value="toggle" className={small}>
                          {s.active ? "Switch off" : "Switch on"}
                        </button>
                        <button type="submit" name="op" value="up" className={small} disabled={typeIndex <= 0}>↑</button>
                        <button type="submit" name="op" value="down" className={small} disabled={typeIndex === types.length - 1}>↓</button>
                      </>
                    )}
                  </ActionForm>
                  <ActionForm action={editSmqSectionAction} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    {ids}
                    <input type="hidden" name="sectionId" value={s.id} />
                    <span className="font-medium">
                      {isAll ? "Every product counts toward:" : "Products of this type count toward:"}
                    </span>
                    {CREDIT_PARTS.map((p) => (
                      <label key={p.key} className="flex items-center gap-1">
                        <input type="checkbox" name="parts" value={p.key} defaultChecked={s.defaultParts.includes(p.key)} className="h-3.5 w-3.5 rounded border-slate-300" />
                        {p.creditCode} {p.label}
                      </label>
                    ))}
                    <button type="submit" name="op" value="parts" className={small}>Save ticks</button>
                  </ActionForm>
                </div>

                <ul className="divide-y divide-slate-100">
                  {s.rows.map((r, ri) => (
                    <li key={r.id} id={`r-${r.id}`} className={`px-4 py-3 ${r.active ? "" : "bg-slate-50"}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-28 shrink-0 space-y-1">
                          <CreditTag row={r} />
                          <div className="text-[11px] text-slate-500">{ROW_KIND_LABEL[r.kind as keyof typeof ROW_KIND_LABEL] ?? r.kind}</div>
                        </div>
                        <div className={`flex-1 text-sm ${r.active ? "text-slate-700" : "text-slate-400 line-through"}`}>
                          <p className="whitespace-pre-line">{r.text}</p>
                          {r.leedRef ? <p className="mt-1 text-xs text-slate-400">LEED: {r.leedRef}</p> : null}
                          {r.targetText ? (
                            <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                              <span className="font-medium">Target:</span> {r.targetText}
                            </p>
                          ) : r.kind === "project_value" ? (
                            <p className="mt-1 text-xs text-amber-700">Project target not set</p>
                          ) : null}
                        </div>
                      </div>
                      <details className="mt-2 pl-[7.75rem]">
                        <summary className="cursor-pointer text-xs font-medium text-brand-600">Edit</summary>
                        <ActionForm action={editSmqRowAction} className="mt-2 space-y-2">
                          {ids}
                          <input type="hidden" name="rowId" value={r.id} />
                          <RowFields row={r} credits={credits} />
                          <div className="flex flex-wrap gap-2">
                            <button type="submit" name="op" value="save" className={small}>Save row</button>
                            <button type="submit" name="op" value="toggle" className={small} formNoValidate>
                              {r.active ? "Switch off" : "Switch on"}
                            </button>
                            <button type="submit" name="op" value="up" className={small} disabled={ri === 0} formNoValidate>↑</button>
                            <button type="submit" name="op" value="down" className={small} disabled={ri === s.rows.length - 1} formNoValidate>↓</button>
                          </div>
                        </ActionForm>
                      </details>
                    </li>
                  ))}
                </ul>
                <details className="border-t border-slate-100 px-4 py-2.5">
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">Add a row under {s.heading}</summary>
                  {/* Keyed by the count: an added row leaves an empty form (QA finding 4). */}
                  <ActionForm key={s.rows.length} action={addSmqRowAction} className="mt-2 space-y-2">
                    {ids}
                    <input type="hidden" name="sectionId" value={s.id} />
                    <RowFields credits={credits} />
                    <button type="submit" className={small}>Add row</button>
                  </ActionForm>
                </details>
              </details>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 px-4 py-3">
        <ActionForm key={smq.sections.length} action={addSmqSectionAction} className="flex items-center gap-2">
          {ids}
          <input name="heading" placeholder="New material type, e.g. Waterproofing membranes" required className="input flex-1" />
          <button type="submit" className={small}>Add material type</button>
        </ActionForm>
      </Card>
    </PageChrome>
  );
}
