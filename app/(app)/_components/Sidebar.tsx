"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  BellIcon,
  BotIcon,
  BuildingIcon,
  CreditsIcon,
  DashboardIcon,
  FileIcon,
  LeafIcon,
  ProjectsIcon,
  ReportsIcon,
  SettingsIcon,
  TaskIcon,
  UsersIcon,
} from "@/components/icons";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  wired: boolean;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: DashboardIcon, wired: true },
      { label: "Projects", href: "/projects", icon: ProjectsIcon, wired: true },
      { label: "Credits", href: "/credits", icon: CreditsIcon, wired: true },
      { label: "Task Board", href: "/task-board", icon: TaskIcon, wired: false },
      { label: "Documents", href: "/documents", icon: FileIcon, wired: true },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "AI Assistant", href: "/assistant", icon: BotIcon, wired: true },
      { label: "Reports", href: "/reports", icon: ReportsIcon, wired: false },
    ],
  },
  {
    title: "Organization",
    items: [
      { label: "Users", href: "/users", icon: UsersIcon, wired: false },
      { label: "Departments", href: "/departments", icon: BuildingIcon, wired: false },
      { label: "Notifications", href: "/notifications", icon: BellIcon, wired: false },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Catalog", href: "/admin/catalog", icon: CreditsIcon, wired: true },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: "/settings", icon: SettingsIcon, wired: false },
    ],
  },
];

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
          <LeafIcon width={20} height={20} />
        </span>
        <div>
          <div className="text-[15px] font-semibold leading-tight text-white">
            NetZero
          </div>
          <div className="text-[11px] text-slate-400">Compliance</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-brand-500/15 font-medium text-brand-200"
                          : "text-slate-400 hover:bg-sidebar-hover hover:text-slate-100"
                      }`}
                    >
                      <Icon width={18} height={18} />
                      <span className="flex-1">{item.label}</span>
                      {!item.wired ? (
                        <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-slate-400">
                          soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/5 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">
            {userName}
          </div>
          <div className="text-xs text-slate-400">Solo workspace</div>
        </div>
      </div>
    </aside>
  );
}
