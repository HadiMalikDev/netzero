import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { BellIcon, SearchIcon } from "@/components/icons";

export interface Crumb {
  label: string;
  href?: string;
}

export function TopBar({
  crumbs,
  userName,
}: {
  crumbs: Crumb[];
  userName: string;
}) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-slate-300">/</span> : null}
            {c.href && i < crumbs.length - 1 ? (
              <Link
                href={c.href}
                className="text-slate-400 hover:text-slate-700 hover:underline"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={
                  i === crumbs.length - 1
                    ? "font-medium text-slate-800"
                    : "text-slate-400"
                }
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 sm:flex">
          <SearchIcon width={16} height={16} />
          <span>Search…</span>
          <kbd className="rounded bg-white px-1.5 text-xs text-slate-400 ring-1 ring-slate-200">
            ⌘K
          </kbd>
        </div>
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100"
        >
          <BellIcon width={18} height={18} />
        </button>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100"
            title="Sign out"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">
              Sign out
            </span>
          </button>
        </form>
      </div>
    </header>
  );
}
