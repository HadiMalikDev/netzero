"use client";

import type { ReactNode } from "react";

/**
 * A submit button that asks first, for removals that can't be undone
 * (QA finding 3), like the credit evidence's "Remove this attachment?".
 */
export function ConfirmSubmit({ message, className, title, children }: { message: string; className?: string; title?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
