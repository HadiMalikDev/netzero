"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface TreeCredit {
  code: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  pointsRaw: string | null;
  isKeystone: boolean;
  changed: boolean;
  added: number;
  corrected: number;
}

/**
 * GitHub "Files changed"-style two-pane layout. Left = a navigable credit tree
 * (category → credit + points) with change badges; right = the server-rendered
 * diff cards passed as children. A "Changed only" toggle hides unchanged
 * credits/rows via a CSS class (see .changed-only in globals.css).
 */
export function DiffReview({
  credits,
  children,
}: {
  credits: TreeCredit[];
  children: ReactNode;
}) {
  const [changedOnly, setChangedOnly] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const changedCount = credits.filter((c) => c.changed).length;

  // Highlight the credit currently in view.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(
      'section[id^="credit-"]',
    );
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace("credit-", ""));
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // Group tree by category.
  const groups = new Map<string, { name: string; items: TreeCredit[] }>();
  for (const c of credits) {
    const g = groups.get(c.categoryCode) ?? { name: c.categoryName, items: [] };
    g.items.push(c);
    groups.set(c.categoryCode, g);
  }
  const grouped = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className={changedOnly ? "changed-only" : ""}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[264px_1fr]">
        {/* Left — credit tree */}
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setChangedOnly(false)}
              className={`flex-1 rounded-md px-2 py-1 font-medium ${
                !changedOnly ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
            >
              All ({credits.length})
            </button>
            <button
              type="button"
              onClick={() => setChangedOnly(true)}
              className={`flex-1 rounded-md px-2 py-1 font-medium ${
                changedOnly ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
            >
              Changed ({changedCount})
            </button>
          </div>

          {grouped.map(([code, g]) => (
            <div key={code} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {code} · {g.name}
              </div>
              <ul>
                {g.items.map((c) => (
                  <li key={c.code} data-changed={c.changed ? "true" : "false"}>
                    <a
                      href={`#credit-${c.code}`}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                        active === c.code
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{c.code}</span>{" "}
                        <span className="text-slate-400">{c.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {c.pointsRaw ? (
                          <span className="text-[10px] text-slate-400">
                            {c.pointsRaw}p
                          </span>
                        ) : null}
                        {c.changed ? (
                          <span className="rounded bg-brand-100 px-1 text-[10px] font-semibold text-brand-700">
                            {c.added ? `+${c.added}` : ""}
                            {c.corrected ? `~${c.corrected}` : ""}
                          </span>
                        ) : null}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        {/* Right — diff cards */}
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  );
}
