import type { MaterialProduct } from "@/db/schema";
import { ReadField } from "@/components/EditableSection";

/** The SMQ's "Manufacture and Product Information" block. */
export function ProductHeaderFields({
  values,
  defaults,
  disabled = false,
}: {
  values?: MaterialProduct;
  defaults?: { supplier?: string | null };
  disabled?: boolean;
}) {
  const field = "text-sm font-medium text-slate-700";
  return (
    <fieldset disabled={disabled} className="grid gap-3 md:grid-cols-6">
      <label className={`${field} md:col-span-3`}>
        Material subject (product)
        <input name="name" required defaultValue={values?.name} placeholder="Jotafloor Easyflow Primer HS" className="input mt-1" />
      </label>
      <label className={`${field} md:col-span-3`}>
        Location of use
        <input name="locationOfUse" defaultValue={values?.locationOfUse ?? ""} placeholder="Flooring" className="input mt-1" />
      </label>
      <label className={`${field} md:col-span-2`}>
        Manufacturer
        <input name="manufacturer" defaultValue={values?.manufacturer ?? ""} className="input mt-1" />
      </label>
      <label className={`${field} md:col-span-2`}>
        Supplier / sub-contractor
        <input name="supplier" defaultValue={values?.supplier ?? defaults?.supplier ?? ""} className="input mt-1" />
      </label>
      <label className={`${field} md:col-span-2`}>
        Country of origin
        <input name="countryOfOrigin" defaultValue={values?.countryOfOrigin ?? ""} className="input mt-1" />
      </label>
      <label className={`${field} md:col-span-3`}>
        Contact person
        <input name="contactName" defaultValue={values?.contactName ?? ""} className="input mt-1" />
      </label>
      <label className={`${field} md:col-span-3`}>
        Mobile no.
        <input name="contactMobile" defaultValue={values?.contactMobile ?? ""} className="input mt-1" />
      </label>
    </fieldset>
  );
}

/** The same block as saved, for reading at a glance. */
export function ProductHeaderView({ values: p }: { values: MaterialProduct }) {
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
      <ReadField label="Material subject (product)">{p.name}</ReadField>
      <ReadField label="Location of use">{p.locationOfUse}</ReadField>
      <ReadField label="Manufacturer">{p.manufacturer}</ReadField>
      <ReadField label="Supplier / sub-contractor">{p.supplier}</ReadField>
      <ReadField label="Country of origin">{p.countryOfOrigin}</ReadField>
      <ReadField label="Contact">{[p.contactName, p.contactMobile].filter(Boolean).join(" · ")}</ReadField>
    </dl>
  );
}
