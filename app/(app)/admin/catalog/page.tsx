import Link from "next/link";
import { PageChrome, PageHeader } from "../../_components/PageChrome";
import { Card, Badge } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { CreditsIcon } from "@/components/icons";
import { listRatingSystems, listVersions } from "@/lib/catalog";
import { BuildFromManual } from "./BuildFromManual";

export default async function CatalogAdminPage() {
  const systems = await listRatingSystems();
  const versions = await listVersions();

  // Group versions under their rating system.
  const bySystem = new Map<string, typeof versions>();
  for (const v of versions) {
    const arr = bySystem.get(v.ratingSystemName) ?? [];
    arr.push(v);
    bySystem.set(v.ratingSystemName, arr);
  }

  return (
    <PageChrome crumbs={[{ label: "Admin" }, { label: "Catalog" }]}>
      <PageHeader
        title="Rating-system catalog"
        subtitle="Standardized Mostadam rulebooks, authored once from a manual and reused by every project."
      />

      <Card className="mb-8 p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">
          Build a version from a manual
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Upload a Mostadam PDF; the parser extracts every credit into a draft you
          review and promote into the catalog.
        </p>
        <BuildFromManual />
      </Card>

      {systems.length === 0 ? (
        <EmptyState
          title="No catalog yet"
          description="Run `pnpm db:seed:catalog` to author Mostadam Commercial D+C (HC-10), or build a version from a manual above."
          icon={<CreditsIcon width={28} height={28} />}
        />
      ) : (
        <div className="space-y-8">
          {[...bySystem.entries()].map(([systemName, vers]) => (
            <div key={systemName}>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">
                {systemName}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vers.map(({ version, creditCount }) => (
                  <Link key={version.id} href={`/admin/catalog/${version.id}`}>
                    <Card className="h-full p-5 transition-shadow hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 capitalize">
                          {version.scheme} · {version.stage}
                        </span>
                        <Badge tone={version.status === "published" ? "brand" : "amber"}>
                          {version.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        Version {version.versionLabel}
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                        <CreditsIcon width={16} height={16} />
                        {creditCount} credit{creditCount === 1 ? "" : "s"} in catalog
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageChrome>
  );
}
