import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
      {icon ? <div className="mb-3 text-slate-400">{icon}</div> : null}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** For chrome-only nav items that are intentionally not built in Stage 1. */
export function NotInSlice({ name }: { name: string }) {
  return (
    <EmptyState
      title={`${name} isn't in this slice`}
      description="This screen is part of the shell for parity with the reference app. It will be wired in a later stage — no placeholder data is shown here on purpose."
    />
  );
}
