"use client";

import { useState } from "react";

/**
 * An "Active" on/off switch that submits its form with op=toggle. It flips
 * as soon as it is clicked; the saved value replaces that when the page
 * refreshes. An inactive questionnaire row or material type is not given to
 * products added from then on; answers already given stay.
 */
export function ActiveSwitch({ active, what }: { active: boolean; what: string }) {
  const [clicked, setClicked] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(active);
  if (saved !== active) {
    setSaved(active);
    setClicked(null);
  }
  const on = clicked ?? active;
  return (
    <button
      type="submit"
      name="op"
      value="toggle"
      role="switch"
      aria-checked={on}
      onClick={() => setClicked(!on)}
      title={on ? `Active: products added from now on get this ${what}` : `Inactive: products added from now on don't get this ${what}`}
      className="inline-flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-brand-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
      Active
    </button>
  );
}
