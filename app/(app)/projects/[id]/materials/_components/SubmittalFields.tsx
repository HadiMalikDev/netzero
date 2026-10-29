import { ReadField } from "@/components/EditableSection";
import { todayIso } from "@/lib/materials/expiry";

/** The submittal's own fields, for creating and editing one. */
export function SubmittalFields({ values }: { values?: { ref: string; title: string; discipline: string | null; supplier: string | null; submittedOn: string | null } }) {
  return (
    <div className="grid gap-3 md:grid-cols-6">
      <label className="text-sm font-medium text-slate-700 md:col-span-2">
        Submittal reference
        <input name="ref" required defaultValue={values?.ref} placeholder="JCD-OCN-MBL-PRO-MTS-0411" className="input mt-1" />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-4">
        Title
        <input name="title" required defaultValue={values?.title} placeholder="All epoxy flooring systems" className="input mt-1" />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">
        Discipline
        <input name="discipline" defaultValue={values?.discipline ?? ""} placeholder="Civil, Architecture, MEP…" className="input mt-1" />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">
        Supplier / sub-contractor
        <input name="supplier" defaultValue={values?.supplier ?? ""} className="input mt-1" />
      </label>
      <label className="text-sm font-medium text-slate-700 md:col-span-2">
        Date of submission
        <input name="submittedOn" type="date" defaultValue={values?.submittedOn ?? ""} max={todayIso()} className="input mt-1" />
      </label>
    </div>
  );
}

/** The submittal as saved. */
export function SubmittalView({ values: v }: { values: { ref: string; title: string; discipline: string | null; supplier: string | null; submittedOn: string | null } }) {
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
      <ReadField label="Submittal reference">{v.ref}</ReadField>
      <ReadField label="Title" className="md:col-span-2">{v.title}</ReadField>
      <ReadField label="Discipline">{v.discipline}</ReadField>
      <ReadField label="Supplier / sub-contractor">{v.supplier}</ReadField>
      <ReadField label="Date of submission">{v.submittedOn}</ReadField>
    </dl>
  );
}
