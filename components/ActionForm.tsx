"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { FORM_ERRORS, type FormAction, type FormErrorCode } from "@/lib/materials/form-errors";

/**
 * A form whose server action returns why it was not saved (QA finding 1).
 * It submits without the browser's form reset, so a refused save leaves
 * everything typed in place and shows the reason here instead of an error
 * page; a save that succeeds redirects as before. The clicked button's
 * name/value (e.g. op=rename) is sent like a normal submit.
 */
export function ActionForm({
  action,
  children,
  className,
  id,
  onSaved,
  editing,
}: {
  action: FormAction | ((formData: FormData) => Promise<void>);
  children: ReactNode;
  className?: string;
  id?: string;
  /** Called once the action went through: it redirected, or returned no error. */
  onSaved?: () => void;
  /** Marks the form as open for editing (data-editing), for the page to style. */
  editing?: boolean;
}) {
  const [error, setError] = useState<FormErrorCode | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(e.currentTarget, submitter);
    // Cleared first: a save that succeeds redirects and never returns here.
    setError(null);
    start(async () => {
      let code: FormErrorCode | null = null;
      try {
        code = (await action(data)) ?? null;
        setError(code);
      } finally {
        // A redirect rejects the call, so success is "no error code came back".
        if (!code) onSaved?.();
      }
    });
  }

  return (
    <form id={id} onSubmit={onSubmit} aria-busy={pending} data-editing={editing || undefined} className={className}>
      {children}
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-600/20 md:col-span-full">
          {FORM_ERRORS[error]} Nothing was saved.
        </p>
      ) : null}
    </form>
  );
}
