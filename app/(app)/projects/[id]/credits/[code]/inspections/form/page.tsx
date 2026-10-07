import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../../../_components/PageChrome";
import { Button, Card } from "@/components/ui";
import { getCreditByCode, getProject } from "@/lib/data";
import { defaultTemplateFor, getForm, projectTemplate } from "@/lib/checklists";
import {
  addItemAction,
  addSectionAction,
  copyFormAction,
  editFormTextAction,
  editItemAction,
  editSectionAction,
} from "../../../../../inspection-actions";

/**
 * Edit a project's inspection form (Sprint 2 item 3): rename, reorder, add,
 * and switch items off. Only the project's own copy is editable; the standard
 * form stays as it is for other projects. Past inspections keep the wording
 * they were filled with. Plain forms, so each change saves on its own.
 */

const small =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40";

export default async function FormEditorPage({
  params,
}: PageProps<"/projects/[id]/credits/[code]/inspections/form">) {
  const { id, code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const project = await getProject(id);
  if (!project) notFound();
  const credit = await getCreditByCode(id, code);
  if (!credit) notFound();
  const own = await projectTemplate(credit.projectCreditId);
  const shown = own ?? (await defaultTemplateFor(credit.title));
  if (!shown) notFound();
  const form = await getForm(shown.id);
  const base = `/projects/${id}/credits/${encodeURIComponent(code)}/inspections`;
  const ids = (
    <>
      <input type="hidden" name="projectId" value={id} />
      <input type="hidden" name="code" value={code} />
    </>
  );
  const activeCount = form.reduce((n, s) => n + s.items.filter((i) => i.active).length, 0);

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: credit.code, href: `/projects/${id}/credits/${encodeURIComponent(code)}` },
        { label: "Inspections", href: base },
        { label: "Edit form" },
      ]}
    >
      <PageHeader
        title="Edit inspection form"
        subtitle={`${project.name} · ${credit.code} ${credit.title} · ${activeCount} items in use. Changes apply to new inspections; past ones keep the wording they were filled with.`}
        action={
          <Link href={base} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Inspections
          </Link>
        }
      />

      {!own ? (
        <Card className="mb-6 flex flex-wrap items-center gap-4 px-5 py-4">
          <p className="flex-1 text-sm text-slate-600">
            This project uses the standard form, shown below. To change it for this project only, make
            the project its own copy first. Other projects keep the standard form.
          </p>
          <form action={copyFormAction}>
            {ids}
            <Button type="submit">Make this project&apos;s own copy</Button>
          </form>
        </Card>
      ) : (
        <Card className="mb-6 px-5 py-4">
          <form action={editFormTextAction} className="grid gap-3">
            {ids}
            <label className="text-sm font-medium text-slate-700">
              Form title
              <input name="title" defaultValue={shown.title} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Confirmation statement (printed above the sign-off; leave empty for none)
              <textarea name="confirmation" defaultValue={shown.confirmation} rows={3} className="input mt-1" />
            </label>
            <div>
              <button type="submit" className={small}>Save title and statement</button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-4">
        {form.map((s, si) => (
          <Card key={s.id} className="overflow-hidden">
            <div className="flex items-center gap-3 bg-slate-100 px-4 py-2.5">
              <span className="w-8 rounded bg-slate-600 py-1 text-center text-xs font-semibold text-white">{s.no}</span>
              {own ? (
                <form action={editSectionAction} className="flex flex-1 items-center gap-2">
                  {ids}
                  <input type="hidden" name="sectionId" value={s.id} />
                  <input name="heading" defaultValue={s.heading} className="input flex-1 font-semibold" />
                  <button type="submit" name="op" value="rename" className={small}>Save</button>
                  <button type="submit" name="op" value="up" className={small} disabled={si === 0}>↑</button>
                  <button type="submit" name="op" value="down" className={small} disabled={si === form.length - 1}>↓</button>
                </form>
              ) : (
                <span className="text-sm font-semibold text-slate-800">{s.heading}</span>
              )}
            </div>
            <ul className="divide-y divide-slate-100">
              {s.items.map((it, ii) => (
                <li key={it.id} className={`flex items-center gap-3 px-4 py-2 ${it.active ? "" : "bg-slate-50"}`}>
                  <span className={`w-8 text-center text-xs font-semibold ${it.active ? "text-slate-600" : "text-slate-300"}`}>
                    {it.no ?? "off"}
                  </span>
                  {own ? (
                    <form action={editItemAction} className="flex flex-1 items-center gap-2">
                      {ids}
                      <input type="hidden" name="itemId" value={it.id} />
                      <input
                        name="text"
                        defaultValue={it.text}
                        className={`input flex-1 ${it.active ? "" : "text-slate-400 line-through"}`}
                      />
                      <select
                        name="compliant"
                        defaultValue={it.compliantAnswer ?? ""}
                        title="Which answer means compliant. The AI only ever suggests Yes where Yes is compliant."
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600"
                      >
                        <option value="yes">Yes = compliant</option>
                        <option value="no">No = compliant</option>
                        <option value="">Observation</option>
                      </select>
                      <button type="submit" name="op" value="compliance" className={small}>Set</button>
                      <button type="submit" name="op" value="save" className={small}>Save</button>
                      <button type="submit" name="op" value="toggle" className={small}>
                        {it.active ? "Switch off" : "Switch on"}
                      </button>
                      <button type="submit" name="op" value="up" className={small} disabled={ii === 0}>↑</button>
                      <button type="submit" name="op" value="down" className={small} disabled={ii === s.items.length - 1}>↓</button>
                    </form>
                  ) : (
                    <span className="flex-1 text-sm text-slate-700">{it.text}</span>
                  )}
                </li>
              ))}
            </ul>
            {own ? (
              <form action={addItemAction} className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5">
                {ids}
                <input type="hidden" name="sectionId" value={s.id} />
                <span className="w-8" />
                <input name="text" placeholder={`New item under ${s.heading}`} className="input flex-1" />
                <button type="submit" className={small}>Add item</button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>

      {own ? (
        <Card className="mt-4 px-4 py-3">
          <form action={addSectionAction} className="flex items-center gap-2">
            {ids}
            <input name="heading" placeholder="New section heading" className="input flex-1" />
            <button type="submit" className={small}>Add section</button>
          </form>
        </Card>
      ) : null}
    </PageChrome>
  );
}
