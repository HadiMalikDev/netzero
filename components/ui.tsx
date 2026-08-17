import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Shared primary-CTA styling (use on <Link>/<label>; <Button> applies it too). */
export const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700";

/** Primary <button>. Inherits every native button prop (type, formAction, …). */
export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${primaryButtonClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "brand" | "emerald" | "amber" | "slate" | "red";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-500",
    red: "bg-red-50 text-red-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        {icon ? (
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-sm text-slate-500">{hint}</div> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "brand" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600 ring-slate-400/20",
    brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
