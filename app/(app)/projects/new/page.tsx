import Link from "next/link";
import { PageChrome, PageHeader } from "../../_components/PageChrome";
import { Card, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { listPublishedVersions } from "@/lib/catalog";
import { Wizard } from "./Wizard";

export default async function NewProjectPage() {
  const versions = await listPublishedVersions();
  const options = versions.map((v) => ({
    id: v.version.id,
    label: `${v.ratingSystemName} — ${v.version.scheme} ${v.version.stage}`,
    versionLabel: v.version.versionLabel,
    creditCount: v.creditCount,
  }));

  return (
    <PageChrome
      crumbs={[
        { label: "Home", href: "/dashboard" },
        { label: "Projects", href: "/projects" },
        { label: "New Project" },
      ]}
    >
      <PageHeader
        title="New Project"
        subtitle="General Info and Certification (pick a rating-system version) are required; the rest are optional in this slice."
      />
      {options.length === 0 ? (
        <EmptyState
          title="No published catalog versions"
          description="Author a rating-system version in the Catalog admin first (run `pnpm db:seed:catalog` for Mostadam Commercial D+C · HC-10), then create a project from it."
          action={
            <Link
              href="/admin/catalog"
              className={primaryButtonClass}
            >
              Go to Catalog admin
            </Link>
          }
        />
      ) : (
        <Card className="p-0">
          <Wizard versions={options} />
        </Card>
      )}
    </PageChrome>
  );
}
