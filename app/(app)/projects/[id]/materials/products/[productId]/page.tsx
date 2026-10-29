import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../../_components/PageChrome";
import { ActionForm } from "@/components/ActionForm";
import { EditableSection, ReadField } from "@/components/EditableSection";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Badge, Card, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { MaterialStatus } from "@/components/MaterialStatus";
import { MaterialUpload } from "@/components/MaterialUpload";
import { getProject } from "@/lib/data";
import { expiryOf, todayIso } from "@/lib/materials/expiry";
import { formatQty } from "@/lib/materials/format";
import { CREDIT_PARTS } from "@/lib/materials/parts";
import { creditProgress } from "@/lib/materials/progress";
import {
  getProduct,
  revLabel,
  SLOT_LABEL,
  SLOTS,
  STATUS_LABEL,
  STATUSES,
  type AnswerView,
  type MaterialDocView,
} from "@/lib/materials/products";
import { ROW_KIND_LABEL } from "@/lib/materials/smq";
import {
  addDeliveryAction,
  newRevisionAction,
  removeDeliveryAction,
  saveBoqQuantitiesAction,
  removeMaterialDocAction,
  saveAnswersAction,
  saveProductHeaderAction,
  saveReviewAction,
  setProductPartsAction,
  setProductTypesAction,
  uploadMaterialDocAction,
} from "../../../../material-actions";
import { ProductHeaderFields, ProductHeaderView } from "../../_components/ProductHeaderFields";

/**
 * One product's SMQ (Sprint 3): the product information, the material types
 * picked for it (their rows follow, D12), what it counts toward (D33), its
 * documents (named slots, D37, and per-row certificates with issue dates,
 * D27), the answers (D10) and the consultant's review (D6, D26). A revision
 * replaced by a newer one is shown read-only (D9).
 */

const ANSWER_LABEL = { yes: "Yes", no: "No", na: "N/A" } as const;

function ExpiryBadge({ issuedOn, years, today }: { issuedOn: string | null; years: number; today: string }) {
  if (!issuedOn) return <span className="text-xs text-slate-400">no issue date</span>;
  const e = expiryOf(issuedOn, years, today);
  const tone =
    e.state === "expired"
      ? "bg-red-50 text-red-700 ring-red-600/20"
      : e.state === "expiring"
        ? "bg-amber-50 text-amber-800 ring-amber-600/20"
        : "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  const text =
    e.state === "expired"
      ? `Expired ${e.expiresOn}`
      : e.state === "expiring"
        ? `Expires ${e.expiresOn} (${e.daysLeft} days)`
        : `Valid until ${e.expiresOn}`;
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}>
      Issued {issuedOn} · {text}
    </span>
  );
}

function DocList({
  docs,
  projectId,
  productId,
  anchor,
  editable,
  years,
  today,
  showExpiry,
}: {
  docs: MaterialDocView[];
  projectId: string;
  productId: string;
  anchor: string;
  editable: boolean;
  years: number;
  today: string;
  showExpiry: boolean;
}) {
  if (!docs.length) return null;
  return (
    <ul className="space-y-1">
      {docs.map((d) => (
        <li key={d.linkId} className="flex flex-wrap items-center gap-2 text-xs">
          <a href={`/api/evidence/${d.docId}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:text-brand-800">
            {d.fileName}
          </a>
          {showExpiry || d.issuedOn ? <ExpiryBadge issuedOn={d.issuedOn} years={years} today={today} /> : null}
          {editable ? (
            <form action={removeMaterialDocAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="linkId" value={d.linkId} />
              <input type="hidden" name="anchor" value={anchor} />
              <ConfirmSubmit
                message={`Remove ${d.fileName} from this product? The file is deleted, unless an earlier revision still lists it.`}
                className="text-slate-400 hover:text-red-600"
                title="Remove this file from the product"
              >
                Remove
              </ConfirmSubmit>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AnswerRow({
  a,
  projectId,
  productId,
  editable,
  years,
  today,
}: {
  a: AnswerView;
  projectId: string;
  productId: string;
  editable: boolean;
  years: number;
  today: string;
}) {
  const kind = ROW_KIND_LABEL[a.kind as keyof typeof ROW_KIND_LABEL] ?? a.kind;
  return (
    <li id={`a-${a.id}`} className="grid gap-3 px-4 py-3 lg:grid-cols-[7rem_1fr_22rem]">
      <div className="space-y-1">
        {a.projectCreditId && a.creditCode ? (
          <Badge tone="brand">{a.creditCode}</Badge>
        ) : a.creditCode ? (
          <Badge tone="amber">{a.creditCode} · unlinked</Badge>
        ) : (
          <Badge>LEED only</Badge>
        )}
        <div className="text-[11px] text-slate-500">{kind}</div>
      </div>
      <div className="text-sm text-slate-700">
        <p className="whitespace-pre-line">{a.text}</p>
        {a.leedRef ? <p className="mt-1 text-xs text-slate-400">LEED: {a.leedRef}</p> : null}
        {a.targetText ? (
          <p className="mt-1 whitespace-pre-line rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
            <span className="font-medium">Project target:</span> {a.targetText}
          </p>
        ) : null}
        {a.note ? <p className="mt-1 whitespace-pre-line text-xs italic text-slate-500">{a.note}</p> : null}
        <div className="mt-2 space-y-1.5">
          <DocList docs={a.docs} projectId={projectId} productId={productId} anchor={`a-${a.id}`} editable={editable} years={years} today={today} showExpiry />
          {editable ? (
            <MaterialUpload
              action={uploadMaterialDocAction}
              fields={{ projectId, productId, answerId: a.id }}
              label="Attach certificate / report"
              requireDate
              maxDate={today}
            />
          ) : null}
        </div>
      </div>
      <fieldset disabled={!editable} className="space-y-2">
        <input type="hidden" name="answerId" value={a.id} form="answers" />
        <div className="flex gap-3 text-sm">
          {(["yes", "no", "na"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name={`answer:${a.id}`} value={v} defaultChecked={a.answer === v} form="answers" />
              {ANSWER_LABEL[v]}
            </label>
          ))}
          <label className="flex items-center gap-1 text-slate-400">
            <input type="radio" name={`answer:${a.id}`} value="" defaultChecked={!a.answer} form="answers" />
            Blank
          </label>
        </div>
        {/* A grid, not flex: .input sets width: 100% outside Tailwind's layers. */}
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <input name={`value:${a.id}`} defaultValue={a.value ?? ""} placeholder="Value" form="answers" className="input text-sm" />
          <input name={`unit:${a.id}`} defaultValue={a.unit ?? ""} placeholder="Unit" form="answers" className="input text-sm" />
        </div>
        <textarea name={`remark:${a.id}`} defaultValue={a.remark ?? ""} placeholder="Remark" rows={2} form="answers" className="input w-full text-sm" />
      </fieldset>
    </li>
  );
}

export default async function ProductPage({ params }: PageProps<"/projects/[id]/materials/products/[productId]">) {
  const { id, productId } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const view = await getProduct(id, productId);
  if (!view) notFound();
  const { product: p, submittal, smq, latest } = view;
  const editable = latest;
  const years = smq.template.expiryYears;
  const today = todayIso();
  const base = `/projects/${id}/materials`;
  const ids = (
    <>
      <input type="hidden" name="projectId" value={id} />
      <input type="hidden" name="productId" value={p.id} />
    </>
  );
  const types = smq.sections.filter((s) => s.kind === "material_type" && (s.active || view.typeIds.includes(s.id)));
  const newest = view.revisions[view.revisions.length - 1];
  const answered = view.sections.flatMap((s) => s.answers);
  const month = today.slice(0, 7);
  const chainKey = view.revisions[0].id;
  const standing = (await creditProgress(id, month))
    .map((r) => ({ part: r.part, mine: r.products.find((x) => x.key === chainKey) }))
    .filter((x) => x.mine);
  // Null when no delivery recorded this quantity, so it prints "—", not 0.
  const delivered = (k: "weightT" | "volumeM3" | "costSar") =>
    view.deliveries.some((d) => d[k] != null) ? view.deliveries.reduce((n, d) => n + (d[k] ?? 0), 0) : null;

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Materials", href: base },
        { label: submittal.ref, href: `${base}/submittals/${submittal.id}` },
        { label: p.name },
      ]}
    >
      <PageHeader
        title={p.name}
        subtitle={`${submittal.ref} · ${revLabel(p.revision)}${p.manufacturer ? ` · ${p.manufacturer}` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <MaterialStatus status={p.status} />
            <a
              href={`/api/projects/${id}/materials/products/${p.id}/pdf`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download SMQ (PDF)
            </a>
          </div>
        }
      />

      {view.revisions.length > 1 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Revisions:</span>
          {view.revisions.map((r) =>
            r.id === p.id ? (
              <span key={r.id} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">
                {revLabel(r.revision)} {r.status ?? ""}
              </span>
            ) : (
              <Link key={r.id} href={`${base}/products/${r.id}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
                {revLabel(r.revision)} {r.status ?? ""}
              </Link>
            ),
          )}
        </div>
      ) : null}
      {!latest ? (
        <Card className="mb-6 border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          This is {revLabel(p.revision)}, kept as it was reviewed. It was resubmitted as{" "}
          <Link href={`${base}/products/${newest.id}`} className="font-semibold underline">
            {revLabel(newest.revision)}
          </Link>
          , which is the one that counts.
        </Card>
      ) : null}

      <Card id="header" className="mb-6 px-5 py-4">
        <EditableSection
          action={saveProductHeaderAction}
          hidden={ids}
          locked={!editable}
          title={<h2 className="text-base font-semibold text-slate-900">Manufacture and product information</h2>}
          view={<ProductHeaderView values={p} />}
          fields={<ProductHeaderFields values={p} />}
          saveLabel="Save product information"
        />
      </Card>

      <Card id="types" className="mb-6 px-5 py-4">
        <EditableSection
          action={setProductTypesAction}
          hidden={ids}
          locked={!editable}
          startOpen={editable && view.typeIds.length === 0}
          title={
            <>
              <h2 className="text-base font-semibold text-slate-900">Material types</h2>
              <p className="text-sm text-slate-500">
                What this product is. The &quot;For all materials&quot; block always applies; each type adds its own rows to the questionnaire below.
              </p>
            </>
          }
          view={
            <div className="mt-3 flex flex-wrap gap-1.5">
              {view.typeIds.length ? (
                types
                  .filter((s) => view.typeIds.includes(s.id))
                  .map((s) => (
                    <Badge key={s.id} tone="brand">
                      {s.heading}
                    </Badge>
                  ))
              ) : (
                <span className="text-sm text-slate-400">None picked yet</span>
              )}
            </div>
          }
          fields={
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {types.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="types" value={s.id} defaultChecked={view.typeIds.includes(s.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                  <span>{s.heading}</span>
                </label>
              ))}
            </div>
          }
          saveLabel="Save material types"
        />

        <div className="mt-5 border-t border-slate-100 pt-4">
          <EditableSection
            action={setProductPartsAction}
            hidden={ids}
            locked={!editable}
            title={
              <>
                <h3 className="text-sm font-semibold text-slate-800">Counts toward</h3>
                <p className="text-xs text-slate-500">
                  Ticked from the material types. Untick what doesn&apos;t apply, e.g. aluminium under &quot;All metals&quot; is not reinforcing steel.
                </p>
              </>
            }
            view={
              <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <ReadField label="Used">{p.interior ? "Interior (inside the weatherproofing line)" : "Exterior"}</ReadField>
                <ReadField label="Credit parts" className="sm:col-span-2">
                  {view.parts.length ? (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {CREDIT_PARTS.filter((part) => view.parts.includes(part.key)).map((part) => (
                        <Badge key={part.key} tone="brand">
                          {part.creditCode} {part.label}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-slate-500">No calculated credit</span>
                  )}
                </ReadField>
              </dl>
            }
            fields={
              <div className="space-y-3">
                <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="interior" value="yes" defaultChecked={p.interior} /> Interior (inside the weatherproofing line)
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="interior" value="no" defaultChecked={!p.interior} /> Exterior
                  </label>
                </div>
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {CREDIT_PARTS.map((part) => (
                    <label key={part.key} className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="parts" value={part.key} defaultChecked={view.parts.includes(part.key)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
                      <span>
                        <span className="font-medium">{part.creditCode}</span> {part.label}
                        {part.interiorOnly ? <span className="text-xs text-slate-400"> · interior only</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            }
          />
        </div>
      </Card>

      <Card id="documents" className="mb-6 px-5 py-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Product documents</h2>
        <ul className="divide-y divide-slate-100">
          {[...SLOTS, null].map((slot) => {
            const docs = view.docs.filter((d) => d.slot === slot);
            return (
              <li key={slot ?? "other"} className="flex flex-wrap items-start gap-3 py-2.5">
                <div className="w-48 text-sm font-medium text-slate-700">
                  {slot ? SLOT_LABEL[slot] : "Other attachments"}
                  {slot && docs.length === 0 ? <div className="text-xs font-normal text-amber-700">Missing</div> : null}
                </div>
                <div className="flex-1 space-y-1.5">
                  <DocList docs={docs} projectId={id} productId={p.id} anchor="documents" editable={editable} years={years} today={today} showExpiry={false} />
                  {editable ? (
                    <MaterialUpload action={uploadMaterialDocAction} fields={{ projectId: id, productId: p.id, slot: slot ?? "" }} requireDate={false} maxDate={today} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <section id="questionnaire" className="mb-6">
        <form id="answers" action={saveAnswersAction}>
          {ids}
        </form>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Questionnaire</h2>
          <span className="text-sm text-slate-500">
            {answered.filter((a) => a.answer).length} of {answered.length} answered
          </span>
        </div>
        <div className="space-y-4">
          {view.sections.map((s) => (
            <Card key={s.sectionId ?? s.heading} className="overflow-hidden">
              <div className="bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">{s.heading}</div>
              <ul className="divide-y divide-slate-100">
                {s.answers.map((a) => (
                  <AnswerRow key={a.id} a={a} projectId={id} productId={p.id} editable={editable} years={years} today={today} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
        {editable ? (
          <div className="sticky bottom-0 mt-4 flex justify-end border-t border-slate-200 bg-white/90 py-3 backdrop-blur">
            <button type="submit" form="answers" className={primaryButtonClass}>
              Save answers
            </button>
          </div>
        ) : null}
      </section>

      <Card id="quantities" className="mb-6 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Quantities</h2>
        <p className="mb-3 text-sm text-slate-500">
          The BOQ quantity is the forecast; deliveries are the actual. Enter what the credits this product counts toward are measured in: steel and
          adhesives by weight, aggregates by volume, timber and KSA content by cost.
        </p>
        <EditableSection
          action={saveBoqQuantitiesAction}
          hidden={ids}
          locked={!editable}
          title={<h3 className="text-sm font-semibold text-slate-800">BOQ quantities (forecast)</h3>}
          view={
            <dl className="mt-3 grid max-w-3xl gap-x-6 gap-y-4 sm:grid-cols-3">
              <ReadField label="Weight">{p.boqWeightT != null ? `${formatQty(p.boqWeightT)} t` : null}</ReadField>
              <ReadField label="Volume">{p.boqVolumeM3 != null ? `${formatQty(p.boqVolumeM3)} m³` : null}</ReadField>
              <ReadField label="Cost">{p.boqCostSar != null ? `SAR ${formatQty(p.boqCostSar)}` : null}</ReadField>
            </dl>
          }
          fields={
            <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                BOQ weight (t)
                <input name="weightT" inputMode="decimal" defaultValue={p.boqWeightT ?? ""} className="input mt-1" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                BOQ volume (m³)
                <input name="volumeM3" inputMode="decimal" defaultValue={p.boqVolumeM3 ?? ""} className="input mt-1" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                BOQ cost (SAR)
                <input name="costSar" inputMode="decimal" defaultValue={p.boqCostSar ?? ""} className="input mt-1" />
              </label>
            </div>
          }
          saveLabel="Save BOQ quantities"
        />

        <h3 className="mt-5 text-sm font-semibold text-slate-800">Deliveries</h3>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1.5 pr-3">Delivered</th>
              <th className="py-1.5 pr-3">PO number</th>
              <th className="py-1.5 pr-3 text-right">Weight (t)</th>
              <th className="py-1.5 pr-3 text-right">Volume (m³)</th>
              <th className="py-1.5 pr-3 text-right">Cost (SAR)</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.deliveries.map((d) => (
              <tr key={d.id}>
                <td className="py-1.5 pr-3">{d.deliveredOn}</td>
                <td className="py-1.5 pr-3">{d.poNumber ?? "—"}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatQty(d.weightT)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatQty(d.volumeM3)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatQty(d.costSar)}</td>
                <td className="py-1.5 text-right">
                  {editable ? (
                    <form action={removeDeliveryAction}>
                      {ids}
                      <input type="hidden" name="deliveryId" value={d.id} />
                      <ConfirmSubmit message={`Remove the delivery of ${d.deliveredOn}${d.poNumber ? ` (${d.poNumber})` : ""}?`} className="text-xs text-slate-400 hover:text-red-600">
                        Remove
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {view.deliveries.length ? (
              <tr className="font-medium text-slate-800">
                <td className="py-1.5 pr-3" colSpan={2}>
                  Delivered to date
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatQty(delivered("weightT"))}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatQty(delivered("volumeM3"))}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatQty(delivered("costSar"))}</td>
                <td />
              </tr>
            ) : (
              <tr>
                <td colSpan={6} className="py-2 text-slate-400">
                  No deliveries logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {editable ? (
          // Keyed by the count, so a delivery that was added leaves an empty form (QA finding 4);
          // a refused one keeps what was typed.
          <ActionForm key={view.deliveries.length} action={addDeliveryAction} className="mt-3 grid gap-2 sm:grid-cols-6">
            {ids}
            <input name="deliveredOn" type="date" required max={today} aria-label="Delivery date" className="input text-sm" />
            <input name="poNumber" placeholder="PO number" className="input text-sm" />
            <input name="weightT" inputMode="decimal" placeholder="t" aria-label="Weight (t)" className="input text-sm" />
            <input name="volumeM3" inputMode="decimal" placeholder="m³" aria-label="Volume (m³)" className="input text-sm" />
            <input name="costSar" inputMode="decimal" placeholder="SAR" aria-label="Cost (SAR)" className="input text-sm" />
            <button type="submit" className={secondaryButtonClass}>
              Add delivery
            </button>
          </ActionForm>
        ) : null}
      </Card>

      {standing.length ? (
        <Card className="mb-6 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Where it stands this month</h2>
          <p className="mb-3 text-sm text-slate-500">How this product counts toward each credit part it is ticked for, as of today.</p>
          <ul className="space-y-2">
            {standing.map(({ part, mine }) => (
              <li key={part.key} className="text-sm">
                <Link href={`/projects/${id}/credits/${encodeURIComponent(part.creditCode)}#material-review`} className="font-medium text-slate-800 hover:text-brand-700">
                  {part.creditCode} {part.label}
                </Link>
                {" · "}
                <span className={mine!.state === "compliant" ? "text-emerald-700" : mine!.state === "pending" ? "text-amber-700" : "text-red-700"}>
                  {mine!.state === "compliant" ? "Counts" : mine!.state === "pending" ? "Pending" : "Does not count"}
                </span>
                {mine!.reasons.length ? <span className="text-slate-500"> — {mine!.reasons.join("; ")}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card id="review" className="mb-6 px-5 py-4">
        <EditableSection
          action={saveReviewAction}
          hidden={ids}
          locked={!editable}
          startOpen={editable && !p.status}
          title={<h2 className="text-base font-semibold text-slate-900">Review</h2>}
          view={
            <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <ReadField label="Status">
                <MaterialStatus status={p.status} />
              </ReadField>
              <ReadField label="Review date">{p.reviewedOn}</ReadField>
              <ReadField label="Reviewed by">{p.reviewer}</ReadField>
              <ReadField label="The proposed material is" className="md:col-span-3">
                {p.applicable === true ? "Applicable to the sustainability requirements" : p.applicable === false ? "Not applicable" : null}
              </ReadField>
              <ReadField label="Consultant remarks" className="sm:col-span-2 md:col-span-3">
                {p.remarks}
              </ReadField>
              <ReadField label="Manufacturer / supplier statement by">
                {[p.manufacturerSignatory, p.manufacturerSignedOn].filter(Boolean).join(" · ")}
              </ReadField>
              <ReadField label="Contractor's sustainability manager">
                {[p.contractorSignatory, p.contractorSignedOn].filter(Boolean).join(" · ")}
              </ReadField>
            </dl>
          }
          fields={
            <div className="grid gap-3 md:grid-cols-6">
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Status
              <select name="status" defaultValue={p.status ?? ""} className="input mt-1">
                <option value="">Under review</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s} · {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Review date
              <input name="reviewedOn" type="date" defaultValue={p.reviewedOn ?? today} min={submittal.submittedOn ?? undefined} max={today} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Reviewed by
              <input name="reviewer" defaultValue={p.reviewer ?? ""} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              The proposed material is
              <select name="applicable" defaultValue={p.applicable === true ? "yes" : p.applicable === false ? "no" : ""} className="input mt-1">
                <option value="">Not stated</option>
                <option value="yes">Applicable to the sustainability requirements</option>
                <option value="no">Not applicable</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-6">
              Consultant remarks (provided documents, comments)
              <textarea name="remarks" defaultValue={p.remarks ?? ""} rows={4} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Manufacturer / supplier statement by
              <input name="manufacturerSignatory" defaultValue={p.manufacturerSignatory ?? ""} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-1">
              Date
              <input name="manufacturerSignedOn" type="date" defaultValue={p.manufacturerSignedOn ?? ""} max={today} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Contractor&apos;s sustainability manager
              <input name="contractorSignatory" defaultValue={p.contractorSignatory ?? ""} className="input mt-1" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-1">
              Date
              <input name="contractorSignedOn" type="date" defaultValue={p.contractorSignedOn ?? ""} max={today} className="input mt-1" />
            </label>
            </div>
          }
          saveLabel="Save review"
        />
        {editable && p.status ? (
          <form action={newRevisionAction} className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            {ids}
            <p className="flex-1 text-sm text-slate-600">
              Resubmitted by the contractor? Start {revLabel(p.revision + 1)} as a copy of this one, without the review and the sign-offs (the new SMQ is signed again). {revLabel(p.revision)} stays as reviewed.
            </p>
            <button type="submit" className={secondaryButtonClass}>
              New revision ({revLabel(p.revision + 1)})
            </button>
          </form>
        ) : null}
      </Card>
    </PageChrome>
  );
}
