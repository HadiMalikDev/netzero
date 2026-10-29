import { STATUS_LABEL, type Status } from "@/lib/materials/products";

const TONE: Record<Status, string> = {
  A: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  B: "bg-teal-50 text-teal-700 ring-teal-600/20",
  C: "bg-amber-50 text-amber-800 ring-amber-600/20",
  D: "bg-red-50 text-red-700 ring-red-600/20",
};

/** A product's review status: "A · Approved", or "Under review" before one is set. */
export function MaterialStatus({ status }: { status: string | null }) {
  const s = status && status in TONE ? (status as Status) : null;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s ? TONE[s] : "bg-slate-100 text-slate-600 ring-slate-400/20"}`}
    >
      {s ? `${s} · ${STATUS_LABEL[s]}` : "Under review"}
    </span>
  );
}
