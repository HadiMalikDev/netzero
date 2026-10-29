import type { MaterialProduct } from "@/db/schema";

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
