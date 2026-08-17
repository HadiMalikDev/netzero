"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import type { Status } from "@/lib/status";

export interface CreditRow {
  code: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  isKeystone: boolean;
  requirementCount: number;
  status: Status;
}

const FILTERS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "in_progress", label: "In Progress" },
  { key: "not_started", label: "Not Started" },
];

export function CreditsTable({
  projectId,
  credits,
}: {
  projectId: string;
  credits: CreditRow[];
}) {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return credits.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (
        q &&
        !c.code.toLowerCase().includes(q) &&
        !c.title.toLowerCase().includes(q) &&
        !c.categoryName.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [credits, filter, query]);

  // Group by category prefix (spec: "Credits table groups by category prefix").
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: CreditRow[] }>();
    for (const c of filtered) {
      const g = map.get(c.categoryCode) ?? { name: c.categoryName, rows: [] };
      g.rows.push(c);
      map.set(c.categoryCode, g);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search credits…"
          className="input max-w-xs"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-slate-400">
          {filtered.length} credit{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">Credit</th>
              <th className="px-5 py-3">Requirements</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([code, g]) => (
              <CategoryGroup
                key={code}
                code={code}
                name={g.name}
                rows={g.rows}
                projectId={projectId}
              />
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-400">
                  No credits match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryGroup({
  code,
  name,
  rows,
  projectId,
}: {
  code: string;
  name: string;
  rows: CreditRow[];
  projectId: string;
}) {
  return (
    <>
      <tr className="bg-slate-50/70">
        <td
          colSpan={3}
          className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          {code} · {name} ({rows.length})
        </td>
      </tr>
      {rows.map((c) => (
        <tr
          key={c.code}
          className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
        >
          <td className="px-5 py-3">
            <Link
              href={`/projects/${projectId}/credits/${c.code}`}
              className="flex items-center gap-2"
            >
              <span className="font-medium text-slate-900">{c.code}</span>
              <span className="text-slate-600">{c.title}</span>
              {c.isKeystone ? (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                  Keystone
                </span>
              ) : null}
            </Link>
          </td>
          <td className="px-5 py-3 text-slate-500">{c.requirementCount}</td>
          <td className="px-5 py-3">
            <StatusPill status={c.status} />
          </td>
        </tr>
      ))}
    </>
  );
}
