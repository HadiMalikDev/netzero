import { Card } from "@/components/ui";
import type { ObservationRow } from "@/lib/observations";
import { addObservationAction, updateObservationAction } from "../../../../inspection-actions";

/**
 * The form's corrective-action log (Sprint 2 item 3), shown under the
 * inspections: one row per observation, as the client's sheet lays it out —
 * observation, recommendation, before photo, corrective action, after photo,
 * observed / closing date, status. Non-compliant answers open rows when a
 * review is saved; the AI drafts each recommendation; everything else is a
 * person's. Plain forms with file inputs, so a row saves in one submit.
 */

const small =
  "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50";

function Photo({ photo, name, label }: { photo: ObservationRow["beforePhoto"]; name: string; label: string }) {
  return (
    <div className="text-xs text-slate-600">
      <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {photo ? (
        <a href={`/api/evidence/${photo.id}`} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- an evidence file served by our own route */}
          <img src={`/api/evidence/${photo.id}`} alt={photo.fileName} className="mb-1 h-24 w-full rounded border border-slate-200 object-cover" />
        </a>
      ) : (
        <div className="mb-1 flex h-24 items-center justify-center rounded border border-dashed border-slate-300 text-slate-400">No photo</div>
      )}
      <input type="file" name={name} accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="w-full text-[11px]" />
    </div>
  );
}

export function ObservationLog({
  title,
  rows,
  projectId,
  code,
}: {
  title: string;
  rows: ObservationRow[];
  projectId: string;
  code: string;
}) {
  const ids = (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="code" value={code} />
    </>
  );
  const open = rows.filter((r) => r.status === "open").length;

  return (
    <section id="observations" className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            Corrective-action log for this credit: {rows.length} observation{rows.length === 1 ? "" : "s"}, {open} open.
            Saving a review opens one for every non-compliant answer; the AI drafts the recommendation.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <Card key={r.id} className="p-4">
            <form action={updateObservationAction} className="grid gap-3 lg:grid-cols-[3rem_1fr_1fr_9rem_1fr_9rem_10rem]">
              {ids}
              <input type="hidden" name="observationId" value={r.id} />
              <div className="text-sm font-semibold text-slate-500">#{i + 1}</div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Observation
                <textarea name="observation" defaultValue={r.observation} rows={4} className="input mt-1 text-sm normal-case tracking-normal" />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Recommendation
                {r.recommendationSource === "ai" ? <span className="ml-1 text-brand-600">· AI draft</span> : null}
                {r.aiState === "pending" && !r.recommendation ? <span className="ml-1 text-slate-400">· AI drafting, refresh</span> : null}
                <textarea name="recommendation" defaultValue={r.recommendation ?? ""} rows={4} className="input mt-1 text-sm normal-case tracking-normal" />
              </label>
              <Photo photo={r.beforePhoto} name="beforePhoto" label="Photo" />
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Corrective action taken
                <textarea name="correctiveAction" defaultValue={r.correctiveAction ?? ""} rows={4} className="input mt-1 text-sm normal-case tracking-normal" />
              </label>
              <Photo photo={r.afterPhoto} name="afterPhoto" label="Photo after" />
              <div className="space-y-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <label className="block">
                  Observed
                  <input type="date" name="observedOn" defaultValue={r.observedOn ?? ""} className="input mt-1 text-sm" />
                </label>
                <label className="block">
                  Closed
                  <input type="date" name="closedOn" defaultValue={r.closedOn ?? ""} className="input mt-1 text-sm" />
                </label>
                <label className="block">
                  Status
                  <select name="status" defaultValue={r.status} className="input mt-1 text-sm">
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <button type="submit" className={small}>Save</button>
              </div>
            </form>
          </Card>
        ))}
      </div>

      <Card className="mt-3 p-4">
        <form action={addObservationAction} className="flex flex-wrap items-end gap-3">
          {ids}
          <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            New observation
            <input name="observation" placeholder="What was observed on site" className="input mt-1 text-sm normal-case tracking-normal" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Observed
            <input type="date" name="observedOn" className="input mt-1 text-sm" />
          </label>
          <button type="submit" className={small}>Add observation</button>
        </form>
      </Card>
    </section>
  );
}
