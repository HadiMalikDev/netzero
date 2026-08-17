"use client";

import { useState } from "react";

/**
 * Renders text in full, but collapses long passages behind a "Read more"
 * toggle instead of hard-truncating them.
 */
export function ExpandableText({
  text,
  clamp = 240,
  className = "",
}: {
  text: string;
  clamp?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > clamp;

  if (!long) return <p className={className}>{text}</p>;

  return (
    <p className={className}>
      {expanded ? text : text.slice(0, clamp).trimEnd() + "… "}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="font-medium text-brand-600 hover:text-brand-700"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </p>
  );
}
