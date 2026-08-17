import Link from "next/link";
import { redirect } from "next/navigation";
import { PageChrome, PageHeader } from "./PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { PlusIcon } from "@/components/icons";
import { primaryButtonClass } from "@/components/ui";
import { firstProjectId } from "@/lib/data";

/**
 * A top-level nav entry (Credits, Documents) that is really scoped to a project:
 * redirect to the current project's `{subpath}` screen, or show a "no project"
 * empty state when none exists yet.
 */
export async function ProjectResolverPage({
  title,
  subpath,
}: {
  title: string;
  subpath: string;
}) {
  const id = await firstProjectId();
  if (id) redirect(`/projects/${id}/${subpath}`);
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
