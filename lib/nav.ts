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
