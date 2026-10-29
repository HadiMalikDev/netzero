import type { ProductView } from "@/lib/materials/products";
import { revLabel, SLOT_LABEL, STATUS_LABEL, type Slot, type Status } from "@/lib/materials/products";
import { expiryOf } from "@/lib/materials/expiry";

/**
 * One product's filled SMQ for print, in the client's form order (SMQ Rev03):
 * Manufacture and Product Information, "For All Materials", the Material
 * Requirements of its material types, the two statements, and the
 * Contractor Sustainability Consultant Remarks. Pure: built from the product
 * view so tests can read it without rendering.
 */

export interface SmqSheetRow {
  materialType: string;
  creditRef: string;
  text: string;
  /** "YES", "NO", "N/A" or "", with the value after it. */
  answer: string;
  remark: string | null;
  target: string | null;
  documents: string[];
}

export interface SmqSheetModel {
  title: string;
  projectName: string;
  info: [string, string][];
  allMaterials: SmqSheetRow[];
  requirements: SmqSheetRow[];
  manufacturer: { name: string; date: string };
  contractor: { name: string; date: string };
  applicable: string;
  providedDocuments: string[];
  remarks: string;
  status: string;
  reviewedBy: string;
  reviewedOn: string;
  generatedAt: string;
  footer: string;
}

const ANSWER: Record<string, string> = { yes: "YES", no: "NO", na: "N/A" };

export function buildSmqSheet(input: {
  view: ProductView;
  projectName: string;
  generatedAt: string;
  today: string;
}): SmqSheetModel {
  const { view } = input;
  const p = view.product;
  const years = view.smq.template.expiryYears;
  const row = (heading: string, a: ProductView["sections"][number]["answers"][number]): SmqSheetRow => ({
    materialType: heading,
    creditRef: [a.leedRef, a.creditCode].filter(Boolean).join(" / "),
    text: a.text,
    answer: [ANSWER[a.answer ?? ""] ?? "", a.value ? `${a.value}${a.unit ? ` ${a.unit}` : ""}` : ""].filter(Boolean).join(": "),
    remark: a.remark,
    target: a.targetText,
    documents: a.docs.map((d) => {
      if (!d.issuedOn) return d.fileName;
      const e = expiryOf(d.issuedOn, years, input.today);
      return `${d.fileName} (issued ${d.issuedOn}${e.state === "expired" ? `, expired ${e.expiresOn}` : ""})`;
    }),
  });
  const all = view.sections.filter((s) => s.kind === "all_materials");
  const types = view.sections.filter((s) => s.kind !== "all_materials");
  const status = p.status ? `${p.status} - ${STATUS_LABEL[p.status as Status]}` : "Under review";
  const provided = [
    ...view.docs.map((d) => `${d.slot ? `${SLOT_LABEL[d.slot as Slot]}: ` : ""}${d.fileName}`),
    ...view.sections.flatMap((s) => s.answers.flatMap((a) => a.docs.map((d) => d.fileName))),
  ];
  return {
    title: view.smq.template.title,
    projectName: input.projectName,
    info: [
      ["Submittal Ref. No:", view.submittal.ref],
      ["Location of use:", p.locationOfUse ?? ""],
      ["Material Subject:", p.name],
      ["Rev.No:", revLabel(p.revision)],
      ["Manufacturer:", p.manufacturer ?? ""],
      ["Supplier/Sub-con:", p.supplier ?? ""],
      ["Country of Origin:", p.countryOfOrigin ?? ""],
      ["Contact Person Name:", p.contactName ?? ""],
      ["Mobile No:", p.contactMobile ?? ""],
    ],
    allMaterials: all.flatMap((s) => s.answers.map((a) => row(s.heading, a))),
    requirements: types.flatMap((s) => s.answers.map((a) => row(s.heading, a))),
    manufacturer: { name: p.manufacturerSignatory ?? "", date: p.manufacturerSignedOn ?? "" },
    contractor: { name: p.contractorSignatory ?? "", date: p.contractorSignedOn ?? "" },
    applicable: p.applicable === true ? "Applicable" : p.applicable === false ? "Not Applicable" : "Applicable / Not Applicable",
    providedDocuments: [...new Set(provided)],
    remarks: p.remarks ?? "",
    status,
    reviewedBy: p.reviewer ?? "",
    reviewedOn: p.reviewedOn ?? "",
    generatedAt: input.generatedAt,
    footer: `${input.projectName} · ${view.submittal.ref} · ${p.name} · ${revLabel(p.revision)}`,
  };
}
