"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createProjectFromCatalog } from "../actions";

const STEPS = [
  "General Info",
  "Certification",
  "Buildings",
  "Departments",
  "Team",
  "Milestones",
  "Review",
];

export interface VersionOption {
  id: string;
  label: string;
  versionLabel: string;
  creditCount: number;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create Project"}
    </button>
  );
}

export function Wizard({ versions }: { versions: VersionOption[] }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [versionId, setVersionId] = useState("");

  const canProceedFromGeneral = name.trim().length > 0;
  const selected = versions.find((v) => v.id === versionId);

  return (
    <form action={createProjectFromCatalog}>
      <input type="hidden" name="rsVersionId" value={versionId} />

      {/* Stepper */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-4">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (i > 0 && !canProceedFromGeneral) return;
              setStep(i);
            }}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              i === step
                ? "bg-brand-600 text-white"
                : i < step
                  ? "bg-brand-50 text-brand-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                i === step ? "bg-white/20" : "bg-white"
              }`}
            >
              {i + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      <div className="px-6 py-8">
        {/* Step 1 — General Info */}
        <section className={step === 0 ? "block" : "hidden"}>
          <h3 className="mb-1 text-lg font-semibold text-slate-900">
            General Info
          </h3>
          <p className="mb-6 text-sm text-slate-500">Project basics.</p>
          <div className="grid max-w-xl gap-4">
            <Field label="Project name *">
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Riyadh Commercial Tower"
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <input
                  name="type"
                  placeholder="Commercial Office"
                  className="input"
                />
              </Field>
              <Field label="Location">
                <input name="location" placeholder="Riyadh, KSA" className="input" />
              </Field>
            </div>
          </div>
        </section>

        {/* Step 2 — Certification (select a catalog version) */}
        <section className={step === 1 ? "block" : "hidden"}>
          <h3 className="mb-1 text-lg font-semibold text-slate-900">
            Certification
          </h3>
          <p className="mb-6 text-sm text-slate-500">
            Choose the <strong>Mostadam rating-system version</strong> this project
            pursues. Its credits are instantiated into your checklist from the
            standardized catalog.
          </p>
          <div className="grid max-w-2xl gap-3">
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVersionId(v.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                  versionId === v.id
                    ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="font-medium text-slate-900">{v.label}</div>
                  <div className="text-sm text-slate-500">
                    Version {v.versionLabel} · {v.creditCount} credits
                  </div>
                </div>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    versionId === v.id
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {versionId === v.id ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Steps 3–6 — chrome, skippable */}
        {[
          {
            i: 2,
            title: "Buildings",
            body: "A project can contain multiple buildings. Not tracked in this slice — skip.",
          },
          {
            i: 3,
            title: "Departments",
            body: "Departments are auto-grouped from each credit's category prefix (HC → Health and Comfort). No manual assignment in this slice — skip.",
          },
          {
            i: 4,
            title: "Team",
            body: "Solo workspace — no team/roles in this slice. Skip.",
          },
          {
            i: 5,
            title: "Milestones",
            body: "No due dates or milestones in this slice. Skip.",
          },
        ].map((s) => (
          <section key={s.i} className={step === s.i ? "block" : "hidden"}>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              {s.title}
            </h3>
            <p className="max-w-lg text-sm text-slate-500">{s.body}</p>
          </section>
        ))}

        {/* Step 7 — Review */}
        <section className={step === 6 ? "block" : "hidden"}>
          <h3 className="mb-1 text-lg font-semibold text-slate-900">Review</h3>
          <p className="mb-6 text-sm text-slate-500">
            Confirm and create. Your checklist is instantiated from the selected
            catalog version.
          </p>
          <dl className="grid max-w-xl gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <Row label="Name" value={name || "—"} />
            <Row
              label="Rating system"
              value={
                selected
                  ? `${selected.label} (${selected.creditCount} credits)`
                  : "Not selected"
              }
            />
          </dl>
        </section>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={step === 0 && !canProceedFromGeneral}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {step >= 2 && step <= 5 ? "Skip" : "Next"}
          </button>
        ) : (
          <SubmitButton disabled={!canProceedFromGeneral || !versionId} />
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
