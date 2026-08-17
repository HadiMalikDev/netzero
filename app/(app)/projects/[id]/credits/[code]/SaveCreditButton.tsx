"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** Submit button for the single per-credit checklist save form. */
export function SaveCreditButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="disabled:opacity-60">
      {pending ? "Saving…" : "Save all"}
    </Button>
  );
}
