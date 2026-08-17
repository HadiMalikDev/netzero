import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { TopBar, type Crumb } from "./TopBar";

/** Wraps a page with the top bar (breadcrumbs) and a scrollable content area. */
export async function PageChrome({
  crumbs,
  children,
  fullBleed = false,
}: {
  crumbs: Crumb[];
  children: ReactNode;
  /** Skip the centered max-width container (for full-width layouts). */
  fullBleed?: boolean;
}) {
  const user = await requireUser();
  return (
    <>
      <TopBar crumbs={crumbs} userName={user.name} />
      <main className="flex-1 overflow-y-auto">
        {fullBleed ? (
          <div className="px-6 py-8">{children}</div>
        ) : (
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        )}
      </main>
    </>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
