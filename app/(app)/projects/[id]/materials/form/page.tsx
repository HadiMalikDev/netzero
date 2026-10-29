import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../_components/PageChrome";
import { ActionForm } from "@/components/ActionForm";
import { ActiveSwitch } from "@/components/ActiveSwitch";
import { CreditPartsPicker } from "@/components/CreditPartsPicker";
import { EditableSection, ReadField } from "@/components/EditableSection";
import { OpenOnHash } from "@/components/OpenOnHash";
import { Badge, Card, secondaryButtonClass, smallPrimaryButtonClass } from "@/components/ui";
import { getProject } from "@/lib/data";
import { partByKey } from "@/lib/materials/parts";
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
 * rows can be renamed, reordered, added and made inactive; each row's credit,
 * kind and project target can be set. Saved values read as text; Edit opens
 * one block's inputs. Products already entered keep the wording they were
 * filled with.
 */

const fieldLabel = "text-sm font-medium text-slate-700";

const partName = (key: string) => {
  const p = partByKey(key);
  return p ? `${p.creditCode} ${p.label}` : key;
};

/** ↑ ↓ for a row or material type; they save at once, like the Active switch. */
function MoveButtons({ disableUp, disableDown, what }: { disableUp: boolean; disableDown: boolean; what: string }) {
  return (
    <span className="inline-flex">
      <button type="submit" name="op" value="up" disabled={disableUp} aria-label={`Move ${what} up`} title={`Move ${what} up`} className={`${secondaryButtonClass} rounded-r-none`}>
        ↑
      </button>
      <button type="submit" name="op" value="down" disabled={disableDown} aria-label={`Move ${what} down`} title={`Move ${what} down`} className={`${secondaryButtonClass} -ml-px rounded-l-none`}>
        ↓
      </button>
    </span>
  );
}

/** A row as saved: its wording, then only the details that are set. */
function RowView({ row }: { row: SmqRowView }) {
  return (
    <div className={`mt-2.5 ${row.active ? "" : "opacity-60"}`}>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{row.text}</p>
      {row.leedRef || row.targetText || row.valueUnit || row.note || row.kind === "project_value" ? (
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {row.targetText || row.kind === "project_value" ? (
            <ReadField label="Project target">
              {row.targetText || <span className="text-amber-700">Not set yet</span>}
            </ReadField>
          ) : null}
          {row.valueUnit ? <ReadField label="Value unit">{row.valueUnit}</ReadField> : null}
          {row.leedRef ? <ReadField label="LEED reference (shown only)">{row.leedRef}</ReadField> : null}
          {row.note ? <ReadField label="Note">{row.note}</ReadField> : null}
        </dl>
      ) : null}
    </div>
  );
}

function RowFields({
  row,
  credits,
}: {
  row?: SmqRowView;
  credits: { id: string; code: string; title: string }[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className={`${fieldLabel} md:col-span-2`}>
        Required documents / parameters
        <textarea name="text" defaultValue={row?.text ?? ""} rows={4} className="input mt-1 text-sm" required />
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
      <span title="This project's catalog has no credit with this code. Pick one with Edit.">
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
      <OpenOnHash />
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
        <EditableSection
          action={saveSmqSettingsAction}
          hidden={ids}
          title={<h2 className="text-base font-semibold text-slate-900">Settings</h2>}
          view={
            <dl className="mt-3 grid gap-4 sm:grid-cols-3">
              <ReadField label="Questionnaire title">{smq.template.title}</ReadField>
              <ReadField label="Certificates expire after">
                {smq.template.expiryYears} year{smq.template.expiryYears === 1 ? "" : "s"}
              </ReadField>
              <ReadField label="Total material cost from the BOQ, for RC-01">
                {smq.template.boqMaterialCostSar != null ? `SAR ${Number(smq.template.boqMaterialCostSar).toLocaleString("en-US")}` : null}
              </ReadField>
            </dl>
          }
          fields={
            <div className="grid gap-3 md:grid-cols-3">
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
            </div>
          }
        />
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
          const sectionIds = (
            <>
              {ids}
              <input type="hidden" name="sectionId" value={s.id} />
            </>
          );
          return (
            <Card key={s.id} className={`overflow-hidden ${s.active ? "" : "opacity-70"}`}>
              <details id={`s-${s.id}`} open={isAll} className="group scroll-mt-20">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90">
                    <path fillRule="evenodd" d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06L8.26 14.8a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
                  </svg>
                  <span className="flex-1 text-sm font-semibold text-slate-800">
                    {s.heading}
                    {s.active ? null : (
                      <span className="ml-2 align-middle">
                        <Badge>Inactive</Badge>
                      </span>
                    )}
                  </span>
                  <span className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                    {s.defaultParts.map((k) => (
                      <Badge key={k} tone="brand">
                        {partName(k)}
                      </Badge>
                    ))}
                  </span>
                  <span className="text-xs text-slate-500">
                    {inUse} row{inUse === 1 ? "" : "s"}
                  </span>
                </summary>

                <div className="border-y border-slate-100 bg-slate-50/60 px-5 py-4">
                  <EditableSection
                    action={editSmqSectionAction}
                    hidden={sectionIds}
                    editLabel={isAll ? "Edit" : "Edit type"}
                    summaryTitle
                    title={
                      <dl>
                        <ReadField label={isAll ? "Every product is counted in" : "Products of this type are counted in"}>
                          {s.defaultParts.length ? (
                            <span className="mt-1 flex flex-wrap gap-1.5">
                              {s.defaultParts.map((k) => (
                                <Badge key={k} tone="brand">
                                  {partName(k)}
                                </Badge>
                              ))}
                            </span>
                          ) : (
                            <span className="text-slate-500">No credit calculation</span>
                          )}
                        </ReadField>
                      </dl>
                    }
                    view={null}
                    tools={
                      isAll ? null : (
                        <>
                          <ActiveSwitch active={s.active} what="material type" />
                          <MoveButtons disableUp={typeIndex <= 0} disableDown={typeIndex === types.length - 1} what="material type" />
                        </>
                      )
                    }
                    fields={
                      <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">
                          {isAll ? "Section name" : "Material type name"}
                          <input name="heading" defaultValue={s.heading} required className="input mt-1" />
                        </label>
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {isAll ? "Every product is counted in" : "Products of this type are counted in"}
                          </p>
                          <p className="mb-1.5 text-xs text-slate-500">
                            The credit calculations their quantities add to, e.g. MW-05 Recycled steel adds a product&apos;s weight to the recycled steel share.
                          </p>
                          <CreditPartsPicker defaultValue={s.defaultParts} label={isAll ? "Every product is counted in" : "Products of this type are counted in"} />
                        </div>
                      </div>
                    }
                  />
                </div>

                <ul className="divide-y divide-slate-100">
                  {s.rows.map((r, ri) => (
                    <li key={r.id} id={`r-${r.id}`} className={`scroll-mt-20 px-5 py-4 has-[[data-editing]]:bg-brand-50/40 ${r.active ? "" : "bg-slate-50"}`}>
                      <EditableSection
                        action={editSmqRowAction}
                        hidden={
                          <>
                            {ids}
                            <input type="hidden" name="rowId" value={r.id} />
                          </>
                        }
                        title={
                          <div className="flex flex-wrap items-center gap-2">
                            <CreditTag row={r} />
                            <span className="text-xs text-slate-500">{ROW_KIND_LABEL[r.kind as keyof typeof ROW_KIND_LABEL] ?? r.kind}</span>
                            {r.active ? null : <Badge>Inactive</Badge>}
                          </div>
                        }
                        tools={
                          <>
                            <ActiveSwitch active={r.active} what="row" />
                            <MoveButtons disableUp={ri === 0} disableDown={ri === s.rows.length - 1} what="row" />
                          </>
                        }
                        view={<RowView row={r} />}
                        fields={<RowFields row={r} credits={credits} />}
                        saveLabel="Save row"
                      />
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-100 px-5 py-3">
                  <EditableSection
                    action={addSmqRowAction}
                    hidden={sectionIds}
                    fields={<RowFields credits={credits} />}
                    editLabel={`+ Add a row under ${s.heading}`}
                    saveLabel="Add row"
                  />
                </div>
              </details>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 px-5 py-4">
        <ActionForm key={smq.sections.length} action={addSmqSectionAction} className="flex flex-wrap items-center gap-2">
          {ids}
          <input name="heading" placeholder="New material type, e.g. Waterproofing membranes" required className="input min-w-0 flex-1" />
          <button type="submit" className={smallPrimaryButtonClass}>Add material type</button>
        </ActionForm>
      </Card>
    </PageChrome>
  );
}
