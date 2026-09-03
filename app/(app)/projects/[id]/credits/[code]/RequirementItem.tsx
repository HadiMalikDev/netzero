"use client";

import { useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { ExpandableText } from "@/components/ExpandableText";
import { BandTable } from "@/components/BandTable";
import { MetricBadge, OptionBadge, PointsRange } from "@/components/req";
import { AttachmentList } from "@/components/AttachmentList";
import { deleteEvidence, uploadEvidence } from "../../../actions";
import type { RequirementView } from "@/lib/data";
import type { NumericLimit } from "@/lib/parser/types";
import { bandsFromSpec, firstBands, pointsForValue } from "@/lib/points";

/** id of the single per-credit save form (see the credit detail page header). */
const SAVE_FORM = "save-credit";

/** A short label when the catalog has no explicit title. */
function firstClause(text: string): string {
  const s = text.trim();
  const dot = s.indexOf(". ");
  const cut = dot > 8 && dot < 80 ? dot : Math.min(72, s.length);
  return s.slice(0, cut).replace(/[,;:]\s*$/, "") + (cut < s.length ? "…" : "");
}

export function RequirementItem({
  req,
  projectId,
  code,
  rsVersionId,
  grouped = false,
}: {
  req: RequirementView;
  projectId: string;
  code: string;
  rsVersionId: string | null;
  grouped?: boolean;
}) {
  const limits =
    (req.numericSpec as { limits?: NumericLimit[] } | null)?.limits ?? [];
  const bandSets = bandsFromSpec(req.numericSpec);
  const lookupBands = firstBands(req.numericSpec);
  const [typed, setTyped] = useState<string>(
    req.valueNumber != null ? String(req.valueNumber) : "",
  );
  const typedNum = typed === "" ? null : Number(typed);
  const preview =
    lookupBands.length && typedNum != null && Number.isFinite(typedNum)
      ? pointsForValue(lookupBands, typedNum)
      : null;
  const label = req.title ?? firstClause(req.text);

  return (
    <div
      id={`req-${req.seq}`}
      className="scroll-mt-24 border-b border-slate-100 py-4 last:border-0"
    >
      {/* Row header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
              #{req.seq}
            </span>
            <span className="font-semibold text-slate-900">{label}</span>
            <MetricBadge metricType={req.metricType} />
            <PointsRange spec={req.numericSpec} pointsRaw={req.pointsRaw} />
            {req.optionGroup && !grouped ? <OptionBadge /> : null}
            {req.target && bandSets.length === 0 ? (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                Should be: {req.target}
              </span>
            ) : null}
            {req.status === "completed" && req.pointsEarned > 0 ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                {req.pointsEarned} pts earned
              </span>
            ) : null}
          </div>

          {/* Full manual text + source link */}
          <div className="mt-1.5 text-sm text-slate-500">
            <ExpandableText text={req.text} clamp={160} />
            {rsVersionId && req.pageStart ? (
              <a
                href={`/api/manual/${rsVersionId}#page=${req.pageStart}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                View in manual · p.{req.pageStart} ↗
              </a>
            ) : null}
          </div>
        </div>
        <StatusPill status={req.status} />
      </div>

      {/* Value input — associated with the single per-credit Save form */}
      <div className="mt-3">
        {req.metricType === "BOOLEAN" ? (
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              form={SAVE_FORM}
              name={`bool-${req.entryId}`}
              value="true"
              defaultChecked={req.valueBool === true}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Mark this requirement as done
          </label>
        ) : null}

        {req.metricType === "NUMERIC" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              step="any"
              form={SAVE_FORM}
              name={`num-${req.entryId}`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Measured value"
              className="input max-w-45"
            />
            {req.unit ? (
              <span className="text-sm text-slate-500">{req.unit}</span>
            ) : null}
            {preview != null ? (
              <span className="text-sm font-medium text-brand-700">
                {typedNum}% → {preview} pts
              </span>
            ) : null}
          </div>
        ) : null}

        {req.metricType === "DESCRIPTIVE" ? (
          <textarea
            form={SAVE_FORM}
            name={`text-${req.entryId}`}
            defaultValue={req.valueText ?? ""}
            placeholder="Describe how this requirement is met…"
            rows={2}
            className="input"
          />
        ) : null}
      </div>

      <BandTable sets={bandSets} />

      {/* Extracted limits table (reference detail) */}
      {limits.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-1.5 text-xs font-semibold text-slate-500">
            Extracted limits (max concentration)
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {limits.map((l, i) => (
              <li key={i} className="text-xs text-slate-600">
                {l.name}:{" "}
                <span className="font-medium">
                  ≤ {l.value} {l.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Evidence. Mandatory on every requirement — see requiresEvidence in
          lib/data.ts. There is deliberately no "optional" state here. */}
      <div className="mt-3">
        <span className="text-xs font-semibold text-slate-500">
          Evidence
          <span
            className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              req.evidenceCount > 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            required · {req.evidenceCount} attached
          </span>
        </span>
        <AttachmentList
          attachments={req.attachments}
          entryId={req.entryId}
          projectId={projectId}
          code={code}
          uploadAction={uploadEvidence}
          deleteAction={deleteEvidence}
        />
      </div>
    </div>
  );
}
