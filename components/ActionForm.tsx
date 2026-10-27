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
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  id?: string;
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
      setError(await action(data));
    });
  }

  return (
    <form id={id} onSubmit={onSubmit} aria-busy={pending} className={className}>
      {children}
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-600/20 md:col-span-full">
          {FORM_ERRORS[error]} Nothing was saved.
        </p>
      ) : null}
    </form>
  );
}
