import Link from "next/link";
import { redirect } from "next/navigation";
import { PageChrome, PageHeader } from "./PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { PlusIcon } from "@/components/icons";
import { primaryButtonClass } from "@/components/ui";
import { firstProjectId } from "@/lib/data";
import { searchParamsQuery } from "@/lib/nav";

/**
 * A top-level nav entry (Credits, Documents) that is really scoped to a project:
 * redirect to the current project's `{subpath}` screen, or show a "no project"
 * empty state when none exists yet. Query params (e.g. `?filter=` from a
 * dashboard tile) are forwarded so the destination keeps its meaning.
 */
export async function ProjectResolverPage({
  title,
  subpath,
  searchParams,
}: {
  title: string;
  subpath: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const id = await firstProjectId();
  if (id) redirect(`/projects/${id}/${subpath}${searchParamsQuery(searchParams)}`);
  return (
    <PageChrome crumbs={[{ label: "Home", href: "/dashboard" }, { label: title }]}>
      <PageHeader title={title} />
      <EmptyState
        title="No project yet"
        description={`${title} is scoped to a project. Create one and upload a Mostadam manual first.`}
        action={
          <Link href="/projects/new" className={primaryButtonClass}>
            <PlusIcon width={16} height={16} /> New Project
          </Link>
        }
      />
    </PageChrome>
  );
}
