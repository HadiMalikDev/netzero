import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../_components/PageChrome";
import { Card, Badge } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { getVersion, getVersionCredits } from "@/lib/catalog";
import { updateVersionLabel } from "../actions";

export default async function VersionDetailPage({
  params,
}: PageProps<"/admin/catalog/[versionId]">) {
  const { versionId } = await params;
  const v = await getVersion(versionId);
  if (!v) notFound();
  const groups = await getVersionCredits(versionId);
  const total = groups.reduce((n, g) => n + g.credits.length, 0);

  return (
    <PageChrome
      crumbs={[
        { label: "Admin", href: "/admin/catalog" },
        { label: "Catalog", href: "/admin/catalog" },
        { label: `${v.ratingSystemName} ${v.version.scheme} ${v.version.stage}` },
      ]}
    >
      <PageHeader
        title={`${v.ratingSystemName} — ${v.version.scheme} ${v.version.stage}`}
        subtitle={`Detected from the manual · ${total} credits in catalog`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={v.version.status === "published" ? "brand" : "amber"}>
              {v.version.status}
            </Badge>
            <Link
              href={`/admin/catalog/${versionId}/review`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Parsed drafts →
            </Link>
          </div>
        }
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <Meta label="Organization" value={v.ratingSystemName} />
          <Meta label="Scheme" value={v.version.scheme} />
          <Meta label="Stage" value={v.version.stage} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Version
            </div>
            <form
              action={updateVersionLabel}
              className="mt-1 flex items-center gap-2"
            >
              <input type="hidden" name="versionId" value={versionId} />
              <input
                name="versionLabel"
                defaultValue={v.version.versionLabel}
                className="input h-8 w-28 py-1 text-sm"
              />
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Save
              </button>
            </form>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Organization, scheme, and stage are detected from the manual. The
          version year is usually on the cover (not machine-readable), so set it
          here if it came through as &ldquo;unspecified&rdquo;.
        </p>
      </Card>

      {total === 0 ? (
        <EmptyState
          title="No promoted credits yet"
          description="Parse a manual and promote its credits into this version from the Parsed drafts screen."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.code}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {g.code} · {g.name} ({g.credits.length})
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-slate-100">
                  {g.credits.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/catalog/${versionId}/credits/${c.code}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {c.code}
                          </span>
                          <span className="text-slate-600">{c.title}</span>
                          {c.isKeystone ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                              Keystone
                            </span>
                          ) : null}
                        </span>
                        <span className="text-sm text-slate-400">
                          {c.requirementCount} req ·{" "}
                          {c.pointsRaw ? `${c.pointsRaw} points` : "—"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </PageChrome>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium capitalize text-slate-800">
        {value}
      </div>
    </div>
  );
}
