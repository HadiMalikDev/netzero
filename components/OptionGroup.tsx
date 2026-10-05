import type { ReactNode } from "react";

/**
 * Visual wrapper for mutually-exclusive catalog options. Once a path is picked
 * (`chosenSeq`), the header names it and offers a reset; `resetAction` posts
 * through the credit's Save form so unsaved values on the page are kept.
 */
export function OptionGroup({
  children,
  count,
  chosenSeq,
  resetEntryId,
  resetAction,
  form,
}: {
  children: ReactNode;
  count: number;
  chosenSeq?: number;
  resetEntryId?: string;
  resetAction?: (entryId: string, formData: FormData) => Promise<void>;
  form?: string;
}) {
  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-violet-700">
          {chosenSeq != null ? `Pursuing option #${chosenSeq}` : "Choose one option"}
          <span className="ml-2 font-normal normal-case tracking-normal text-violet-600">
            either/or · credit total is the better of {count} options, not the sum
          </span>
        </div>
        {chosenSeq != null && resetEntryId && resetAction ? (
          <button
            type="submit"
            form={form}
            formAction={resetAction.bind(null, resetEntryId)}
            className="text-xs font-medium text-violet-700 underline-offset-2 hover:underline"
          >
            Reset choice
          </button>
        ) : null}
      </div>
      <div className="space-y-4 divide-y divide-violet-100">{children}</div>
    </div>
  );
}
