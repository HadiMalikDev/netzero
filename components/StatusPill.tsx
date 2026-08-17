const STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  in_progress: "bg-brand-50 text-brand-700 ring-brand-600/20",
  not_started: "bg-slate-100 text-slate-500 ring-slate-400/20",
  // source-document statuses
  parsed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  parsing: "bg-amber-50 text-amber-700 ring-amber-600/20",
  uploaded: "bg-slate-100 text-slate-600 ring-slate-400/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};

const LABELS: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
  parsed: "Parsed",
  parsing: "Parsing…",
  uploaded: "Uploaded",
  rejected: "Rejected",
  failed: "Failed",
};

export function StatusPill({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.not_started;
  const label = LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
