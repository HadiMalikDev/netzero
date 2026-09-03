/**
 * Sidebar link resolution.
 *
 * Credits, Documents and the AI Assistant are project screens reached from a
 * workspace-level nav. Their bare hrefs (`/credits`, …) fall through to
 * ProjectResolverPage, which redirects to the FIRST project in the workspace.
 * That is correct from the dashboard and wrong from inside a project: it walks
 * the user out of the project they are looking at. So while a project is open,
 * these entries address that project directly.
 */

export interface ScopedNavItem {
  href: string;
  projectScoped?: boolean;
}

/** The project being viewed, from `/projects/<id>/...`, or null elsewhere. */
export function activeProjectId(pathname: string): string | null {
  const m = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!m) return null;
  // `/projects/new` is the create wizard, not a project.
  return m[1] === "new" ? null : m[1];
}

/**
 * Where a nav item should point right now. Project-scoped entries follow the
 * open project; everywhere else they keep their workspace href.
 */
export function navHref(item: ScopedNavItem, pathname: string): string {
  if (!item.projectScoped) return item.href;
  const id = activeProjectId(pathname);
  return id ? `/projects/${id}${item.href}` : item.href;
}

/**
 * Query string from a Next.js `searchParams` object, including a leading `?`.
 * Empty / missing values produce an empty string.
 */
export function searchParamsQuery(
  searchParams?: Record<string, string | string[] | undefined>,
): string {
  if (!searchParams) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else {
      params.set(key, value);
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Where a dashboard credits tile should drill to. Same convention as the
 * workspace Credits nav: the first project, with the requested filter applied.
 * With no projects yet, the workspace Credits resolver shows the empty state.
 */
export function dashboardCreditsHref(
  projectIds: string[],
  filter: string,
): string {
  const qs = `filter=${encodeURIComponent(filter)}`;
  return projectIds.length >= 1
    ? `/projects/${projectIds[0]}/credits?${qs}`
    : `/credits?${qs}`;
}
