import Link from "next/link";
import { redirect } from "next/navigation";
import { PageChrome, PageHeader } from "../_components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { PlusIcon } from "@/components/icons";
import { firstProjectId } from "@/lib/data";

/** Top-level "Credits" resolves to the current project's scoped Credits screen. */
export default async function CreditsResolverPage() {
  const id = await firstProjectId();
  if (id) redirect(`/projects/${id}/credits`);
  return (
    <PageChrome crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Credits" }]}>
      <PageHeader title="Credits" />
      <EmptyState
        title="No project yet"
        description="Credits is scoped to a project. Create one and upload a Mostadam manual first."
        action={
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <PlusIcon width={16} height={16} /> New Project
          </Link>
        }
      />
    </PageChrome>
  );
}
