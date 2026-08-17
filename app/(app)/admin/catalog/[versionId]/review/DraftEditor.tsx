"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraftAction } from "../../actions";
import type { ParsedDraftRequirement } from "@/lib/catalog";

const METRICS = ["BOOLEAN", "NUMERIC", "DESCRIPTIVE"] as const;

interface EditRow {
  key: string;
  seq: number;
  title: string;
  text: string;
  pointsRaw: string;
  metricType: string;
  unit: string;
  optionGroup: string;
}

function toRows(reqs: ParsedDraftRequirement[]): EditRow[] {
  return reqs.map((r, i) => ({
    key: `${r.seq}-${i}`,
    seq: r.seq,
    title: r.title ?? "",
    text: r.text,
    pointsRaw: r.pointsRaw ?? "",
    metricType: r.metricType,
    unit: r.unit ?? "",
    optionGroup: r.optionGroup ?? "",
  }));
}

export function DraftEditor({
  versionId,
  parsedCreditId,
  title,
  pointsRaw,
  requirements,
}: {
  versionId: string;
  parsedCreditId: string;
  title: string;
  pointsRaw: string | null;
  requirements: ParsedDraftRequirement[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creditTitle, setCreditTitle] = useState(title);
  const [creditPoints, setCreditPoints] = useState(pointsRaw ?? "");
  const [rows, setRows] = useState<EditRow[]>(() => toRows(requirements));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(key: string, field: keyof EditRow, value: string | number) {
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function addRow() {
    const seq = Math.max(0, ...rows.map((r) => r.seq)) + 1;
    setRows((rs) => [
      ...rs,
      {
        key: `new-${seq}-${Date.now()}`,
        seq,
        title: "",
        text: "",
        pointsRaw: "",
        metricType: "DESCRIPTIVE",
        unit: "",
        optionGroup: "",
      },
    ]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveDraftAction(versionId, parsedCreditId, {
        title: creditTitle.trim() || title,
        pointsRaw: creditPoints.trim() || null,
        requirements: rows.map((r) => {
          const prior = requirements.find((p) => p.seq === r.seq);
          return {
            seq: Number(r.seq) || 0,
            title: r.title.trim() || null,
            text: r.text.trim(),
            pointsRaw: r.pointsRaw.trim() || null,
            metricType: r.metricType,
            unit: r.unit.trim() || null,
            optionGroup: r.optionGroup.trim() || null,
            pointsType: prior?.pointsType ?? null,
          };
        }),
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open)
    return (
      <div className="border-b border-slate-100 px-5 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit draft
        </button>
      </div>
    );

  return (
    <div className="w-full border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-xs font-medium text-slate-500">
          Title
          <input
            value={creditTitle}
            onChange={(e) => setCreditTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        <label className="w-24 text-xs font-medium text-slate-500">
          Total pts
          <input
            value={creditPoints}
            onChange={(e) => setCreditPoints(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.key}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="w-14 text-[11px] font-medium text-slate-500">
                #
                <input
                  type="number"
                  min={1}
                  value={r.seq}
                  onChange={(e) => patch(r.key, "seq", Number(e.target.value))}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                />
              </label>
              <label className="min-w-40 flex-1 text-[11px] font-medium text-slate-500">
                Title
                <input
                  value={r.title}
                  onChange={(e) => patch(r.key, "title", e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                />
              </label>
              <label className="w-20 text-[11px] font-medium text-slate-500">
                Points
                <input
                  value={r.pointsRaw}
                  onChange={(e) => patch(r.key, "pointsRaw", e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                />
              </label>
              <label className="w-36 text-[11px] font-medium text-slate-500">
                Metric
                <select
                  value={r.metricType}
                  onChange={(e) => patch(r.key, "metricType", e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                >
                  {METRICS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-36 flex-1 text-[11px] font-medium text-slate-500">
                Option group (XOR)
                <input
                  value={r.optionGroup}
                  onChange={(e) => patch(r.key, "optionGroup", e.target.value)}
                  placeholder="e.g. E-01 options"
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-1.5 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="mt-4 text-xs font-medium text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
            <textarea
              value={r.text}
              onChange={(e) => patch(r.key, "text", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
            />
          </div>
        ))}
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Add requirement
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setCreditTitle(title);
            setCreditPoints(pointsRaw ?? "");
            setRows(toRows(requirements));
            setError(null);
          }}
          className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
