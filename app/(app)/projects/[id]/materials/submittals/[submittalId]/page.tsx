import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../../_components/PageChrome";
import { EditableSection } from "@/components/EditableSection";
import { Card } from "@/components/ui";
import { MaterialStatus } from "@/components/MaterialStatus";
import { getProject } from "@/lib/data";
import { getSubmittalRow, listSubmittals, revLabel } from "@/lib/materials/products";
import { addProductAction, updateSubmittalAction } from "../../../../material-actions";
import { ProductHeaderFields } from "../../_components/ProductHeaderFields";
import { SubmittalFields, SubmittalView } from "../../_components/SubmittalFields";

/**
 * One material submittal (Sprint 3, D11): its own details and its products.
 * Each product is one SMQ with its own answers, documents and status, as on
 * the contractor's MTS where every product has its own questionnaire.
 */

export default async function SubmittalPage({ params }: PageProps<"/projects/[id]/materials/submittals/[submittalId]">) {
  const { id, submittalId } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const submittal = await getSubmittalRow(id, submittalId);
  if (!submittal) notFound();
  const products = (await listSubmittals(id)).find((s) => s.id === submittalId)?.products ?? [];
  const base = `/projects/${id}/materials`;
  // Latest revision first within each product, products in the order added.
  const chains = products.filter((p) => p.latest);
  const older = products.filter((p) => !p.latest);

  const ids = (
    <>
      <input type="hidden" name="projectId" value={id} />
      <input type="hidden" name="submittalId" value={submittal.id} />
    </>
  );

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Materials", href: base },
        { label: submittal.ref },
      ]}
    >
      <PageHeader
        title={submittal.ref}
        subtitle={`${submittal.title}${submittal.discipline ? ` · ${submittal.discipline}` : ""}${submittal.supplier ? ` · ${submittal.supplier}` : ""}`}
        action={
          <Link href={base} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Materials
          </Link>
        }
      />

      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Products</h2>
          <p className="text-sm text-slate-500">Each product has its own SMQ, documents, quantities and review.</p>
        </div>
        {chains.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No products yet. Add the first one below.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {chains.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Link href={`${base}/products/${p.id}`} className="flex-1 font-medium text-slate-800 hover:text-brand-700">
                  {p.name}
                </Link>
                <span className="text-xs text-slate-500">{p.manufacturer ?? ""}</span>
                <span className="text-xs text-slate-400">{revLabel(p.revision)}</span>
                <MaterialStatus status={p.status} />
                {p.reviewedOn ? <span className="text-xs text-slate-500">reviewed {p.reviewedOn}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {older.length ? (
          <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">
            {older.length} earlier revision{older.length === 1 ? "" : "s"}, kept as reviewed: open a product to see its history.
          </p>
        ) : null}
        <div className="border-t border-slate-100 px-5 py-3">
          <EditableSection
            action={addProductAction}
            hidden={ids}
            fields={<ProductHeaderFields defaults={{ supplier: submittal.supplier }} />}
            editLabel="+ Add a product"
            saveLabel="Add product"
            startOpen={chains.length === 0}
          />
        </div>
      </Card>

      <Card className="px-5 py-4">
        <EditableSection
          action={updateSubmittalAction}
          hidden={ids}
          title={<h2 className="text-base font-semibold text-slate-900">Submittal details</h2>}
          view={<SubmittalView values={submittal} />}
          fields={<SubmittalFields values={submittal} />}
          saveLabel="Save submittal"
        />
      </Card>
    </PageChrome>
  );
}
