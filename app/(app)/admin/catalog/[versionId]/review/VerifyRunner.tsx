"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyCreditAction } from "../../actions";

interface CreditRef {
  id: string;
  code: string;
}
interface LogEntry {
  code: string;
  ok: boolean;
  detail: string;
}

const CONCURRENCY = 5;

export function VerifyRunner({
  credits,
}: {
  credits: CreditRef[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [done, setDone] = useState(0);
  const [inFlight, setInFlight] = useState<string[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const total = credits.length;

  async function run() {
    setStatus("running");
    setDone(0);
    setLog([]);
    setInFlight([]);
    const queue = [...credits];

    const worker = async () => {
      for (;;) {
        const c = queue.shift();
        if (!c) break;
        setInFlight((f) => [...f, c.code]);
        let entry: LogEntry;
        try {
          const r = await verifyCreditAction(c.id);
          entry = r.ok
            ? {
                code: c.code,
                ok: true,
                detail:
                  r.added + r.corrected === 0
                    ? "no changes"
                    : `${r.added} added, ${r.corrected} corrected`,
              }
            : { code: c.code, ok: false, detail: "no proposal" };
        } catch {
          entry = { code: c.code, ok: false, detail: "failed" };
        }
        setInFlight((f) => f.filter((x) => x !== c.code));
        setLog((l) => [entry, ...l]);
        setDone((d) => d + 1);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setStatus("done");
    router.refresh(); // load the stored proposals into the diffs
  }

  if (status === "idle")
    return (
      <button
        type="button"
        onClick={run}
        className="rounded-lg border border-brand-600/30 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
      >
        Verify &amp; complete with AI
      </button>
    );

  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-72">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>
          {status === "done" ? "Verified" : "Verifying"} {done}/{total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {inFlight.length > 0 ? (
        <div className="mt-1.5 text-xs text-brand-600">
          Verifying {inFlight.slice(0, 4).join(", ")}
          {inFlight.length > 4 ? "…" : "…"}
        </div>
      ) : status === "done" ? (
        <div className="mt-1.5 text-xs text-emerald-600">
          Done — loading proposals…
        </div>
      ) : null}
      <ul className="mt-2 max-h-32 overflow-y-auto text-xs">
        {log.slice(0, 12).map((e, i) => (
          <li key={i} className="flex items-center justify-between py-0.5">
            <span className={e.ok ? "text-slate-600" : "text-red-500"}>
              {e.ok ? "✓" : "✗"} {e.code}
            </span>
            <span className="text-slate-400">{e.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
