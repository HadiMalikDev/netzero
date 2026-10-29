"use client";

import { useEffect } from "react";

/**
 * Opens the collapsed <details> holding the element the URL's #anchor names,
 * so a save that returns to "#r-<row>" lands on that row with its material
 * type still open. Runs after every render: a save comes back as a refresh,
 * not a hashchange.
 */
export function OpenOnHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    // Once per element: a section the reader closes again stays closed.
    if (!el || el.dataset.landed) return;
    for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
    el.dataset.landed = "1";
    el.scrollIntoView({ block: "start" });
  });
  return null;
}
