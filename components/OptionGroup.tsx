import type { ReactNode } from "react";

/** Visual wrapper for mutually-exclusive catalog options. */
export function OptionGroup({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-700">
        Choose one option
        <span className="ml-2 font-normal normal-case tracking-normal text-violet-600">
          either/or · credit total is the better of {count} options, not the sum
        </span>
      </div>
      <div className="space-y-4 divide-y divide-violet-100">{children}</div>
    </div>
  );
}
