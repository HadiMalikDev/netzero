import { ExpandableText } from "@/components/ExpandableText";
import type {
  ParsedDraftCredit,
  ParsedDraftRequirement,
  ProposedRequirementView,
} from "@/lib/catalog";
import {
  applyAiProposal,
  promoteCredit,
  rejectAiProposal,
  toggleDropParsed,
} from "../../actions";
import { DraftEditor } from "./DraftEditor";

const METRIC_LABEL: Record<string, string> = {
  BOOLEAN: "Yes/No",
  NUMERIC: "Measured value",
  DESCRIPTIVE: "Document / text",
};

type ChangeKind = "unchanged" | "corrected" | "added";

interface Row {
  seq: number;
  change: ChangeKind;
  original: ParsedDraftRequirement | null;
  proposed: ProposedRequirementView | null;
}

function buildRows(credit: ParsedDraftCredit): Row[] {
  const origBySeq = new Map(credit.requirements.map((r) => [r.seq, r]));
  const propBySeq = new Map((credit.proposal ?? []).map((p) => [p.seq, p]));
  const seqs = [...new Set([...origBySeq.keys(), ...propBySeq.keys()])].sort(
    (a, b) => a - b,
  );
  return seqs.map((seq) => {
    const proposed = propBySeq.get(seq) ?? null;
    const change = (proposed?.change as ChangeKind) ?? "unchanged";
    return {
      seq,
      change,
      original: origBySeq.get(seq) ?? null,
      proposed,
    };
  });
}

export function CreditDiffCard({
  credit,
  versionId,
}: {
  credit: ParsedDraftCredit;
  versionId: string;
}) {
  const hasProposal = credit.aiStatus === "proposed" && !!credit.proposal;
  const rows = buildRows(credit);
  const changed = (credit.proposal ?? []).filter((p) => p.change !== "unchanged");
  const added = changed.filter((p) => p.change === "added").length;
  const corrected = changed.filter((p) => p.change === "corrected").length;

  const isChanged = hasProposal && changed.length > 0;

  return (
    <section
      id={`credit-${credit.code}`}
      data-changed={isChanged ? "true" : "false"}
      className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      {/* File header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{credit.code}</span>
            <span className="text-slate-700">{credit.title}</span>
            {credit.isKeystone ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                Keystone
              </span>
            ) : null}
            {credit.promoted ? (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                In catalog
              </span>
            ) : null}
            {hasProposal && changed.length > 0 ? (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                {added ? `+${added} ` : ""}
                {corrected ? `~${corrected}` : ""} AI
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {credit.pointsRaw ? `${credit.pointsRaw} points · ` : ""}
            {credit.categoryCode} · {credit.categoryName}
            {credit.pageStart ? ` · manual p.${credit.pageStart}` : ""}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasProposal ? (
            <>
              <form action={rejectAiProposal}>
                <input type="hidden" name="versionId" value={versionId} />
                <input type="hidden" name="parsedCreditId" value={credit.id} />
                <button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
                >
                  Reject
                </button>
              </form>
              <form action={applyAiProposal}>
                <input type="hidden" name="versionId" value={versionId} />
                <input type="hidden" name="parsedCreditId" value={credit.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Accept changes
                </button>
              </form>
            </>
          ) : null}
          {!credit.promoted ? (
            <>
              <form action={promoteCredit}>
                <input type="hidden" name="versionId" value={versionId} />
                <input type="hidden" name="parsedCreditId" value={credit.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Promote
                </button>
              </form>
              <form action={toggleDropParsed}>
                <input type="hidden" name="versionId" value={versionId} />
                <input type="hidden" name="parsedCreditId" value={credit.id} />
                <input
                  type="hidden"
                  name="dropped"
                  value={(!credit.dropped).toString()}
                />
                <button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-100"
                >
                  {credit.dropped ? "Restore" : "Drop"}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      {!credit.promoted ? (
        <DraftEditor
          versionId={versionId}
          parsedCreditId={credit.id}
          title={credit.title}
          pointsRaw={credit.pointsRaw}
          requirements={credit.requirements}
        />
      ) : null}

      {credit.requirements.length > 0 &&
      credit.requirements.every((r) => !r.hasEvidence) ? (
        <div className="border-b border-slate-100 bg-amber-50/60 px-5 py-2 text-xs text-amber-800">
          <span className="font-semibold">No evidence extracted</span> for this
          credit — re-parse the manual or check the source pages before
          promoting.
        </div>
      ) : null}

      {/* PDF description (aim) */}
      {credit.aim ? (
        <div className="border-b border-slate-100 px-5 py-3">
          <ExpandableText
            text={credit.aim}
            clamp={260}
            className="text-sm text-slate-500"
          />
        </div>
      ) : null}

      {/* Reconcile-or-fail: extractor disagrees with the manual's own total. */}
      {credit.reconciliation && !credit.reconciliation.ok ? (
        <div className="border-b border-slate-100 bg-amber-50/60 px-5 py-2 text-xs text-amber-800">
          <span className="font-semibold">⚠ Reconcile:</span>{" "}
          {credit.reconciliation.note ||
            `requirements sum to ${credit.reconciliation.got}, manual Total is ${credit.reconciliation.expected}`}{" "}
          — review before promoting.
        </div>
      ) : null}

      {/* Status note for applied/rejected */}
      {credit.aiStatus === "applied" ? (
        <div className="border-b border-slate-100 bg-emerald-50/40 px-5 py-1.5 text-xs font-medium text-emerald-700">
          ✓ AI changes applied
        </div>
      ) : credit.aiStatus === "rejected" ? (
        <div className="border-b border-slate-100 px-5 py-1.5 text-xs text-slate-400">
          AI proposal rejected — deterministic draft kept
        </div>
      ) : null}

      {/* Requirements */}
      {hasProposal ? (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <div className="px-4 py-2">Original (deterministic)</div>
              <div className="border-l border-slate-100 px-4 py-2">
                Proposed (AI)
              </div>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-400">
                No requirements.
              </div>
            ) : null}
            {rows.map((row) => (
              <DiffRow key={row.seq} row={row} />
            ))}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {credit.requirements.length === 0 ? (
            <li className="px-5 py-3 text-sm text-amber-700">
              No requirements parsed — run “Verify &amp; complete with AI” to
              recover them from the source.
            </li>
          ) : null}
          {credit.requirements.map((r) => (
            <li key={r.seq} className="px-5 py-3">
              <ReqCell req={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DiffRow({ row }: { row: Row }) {
  const rightTone =
    row.change === "added"
      ? "bg-emerald-50/50"
      : row.change === "corrected"
        ? "bg-amber-50/40"
        : "";
  return (
    <div className="grid grid-cols-2 border-b border-slate-100 last:border-0">
      {/* Original */}
      <div
        className={`px-4 py-3 text-sm ${row.change === "unchanged" ? "opacity-60" : ""}`}
      >
        {row.original ? (
          <ReqCell req={row.original} />
        ) : (
          <span className="text-xs italic text-slate-400">— not parsed —</span>
        )}
      </div>
      {/* Proposed */}
      <div className={`border-l border-slate-100 px-4 py-3 text-sm ${rightTone}`}>
        {row.change !== "unchanged" ? (
          <div className="mb-1">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                row.change === "added"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {row.change}
            </span>
          </div>
        ) : null}
        {row.proposed ? (
          <ProposedCell proposed={row.proposed} original={row.original} />
        ) : row.original ? (
          <div className="opacity-60">
            <ReqCell req={row.original} />
          </div>
        ) : null}
        {row.proposed?.reasoning ? (
          <p className="mt-2 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Why:</span>{" "}
            {row.proposed.reasoning}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** A deterministic requirement cell. */
function ReqCell({ req }: { req: ParsedDraftRequirement }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-slate-500">#{req.seq}</span>
        <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-slate-600">
          {METRIC_LABEL[req.metricType] ?? req.metricType}
        </span>
        {req.pointsRaw ? (
          <span className="text-slate-400">
            {req.pointsRaw} point{req.pointsRaw === "1" ? "" : "s"}
            {req.pointsType === "scaled" ? " (scaled)" : ""}
          </span>
        ) : null}
        {req.optionGroup ? (
          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
            Option (either/or)
          </span>
        ) : null}
        {req.keystone ? (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
            Keystone
          </span>
        ) : null}
        {Object.entries(req.evidenceByStage).map(([stage, n]) => (
          <span
            key={stage}
            className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
          >
            {stage}: {n}
          </span>
        ))}
        {req.measurable ? (
          <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">
            Target: {req.measurable}
          </span>
        ) : null}
        {req.origin !== "deterministic" ? (
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            {req.origin === "ai_added" ? "AI-added" : "AI-verified"}
          </span>
        ) : null}
      </div>
      <ExpandableText text={req.text} clamp={200} className="text-slate-600" />
    </div>
  );
}

/** The proposed side of a diff row; highlights fields that differ from original. */
function ProposedCell({
  proposed,
  original,
}: {
  proposed: ProposedRequirementView;
  original: ParsedDraftRequirement | null;
}) {
  const hl = (changed: boolean) =>
    changed ? "rounded bg-amber-100/70 px-1 font-medium" : "";
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-slate-500">#{proposed.seq}</span>
        <span
          className={`rounded bg-slate-200/70 px-1.5 py-0.5 text-slate-600 ${hl(
            !!original && original.metricType !== proposed.metricType,
          )}`}
        >
          {METRIC_LABEL[proposed.metricType] ?? proposed.metricType}
        </span>
        {proposed.pointsRaw ? (
          <span
            className={hl(!!original && original.pointsRaw !== proposed.pointsRaw)}
          >
            {proposed.pointsRaw} point{proposed.pointsRaw === "1" ? "" : "s"}
          </span>
        ) : null}
        {proposed.measurable ? (
          <span
            className={`rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700 ${hl(
              !!original && original.measurable !== proposed.measurable,
            )}`}
          >
            Target: {proposed.measurable}
          </span>
        ) : null}
      </div>
      <ExpandableText
        text={proposed.text}
        clamp={200}
        className="text-slate-600"
      />
    </div>
  );
}
