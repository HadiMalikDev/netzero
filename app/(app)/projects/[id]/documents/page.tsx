import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../_components/PageChrome";
import { ProjectTabs } from "../_components/ProjectTabs";
import { Card, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { FileIcon } from "@/components/icons";
import { getProject, listProjectEvidence } from "@/lib/data";
import { formatFileSize, formatUploadedAt } from "@/lib/format";

export default async function DocumentsPage({
  params,
}: PageProps<"/projects/[id]/documents">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const evidence = await listProjectEvidence(id);

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Documents" },
      ]}
    >
      <PageHeader
        title="Evidence Library"
        subtitle="Every file attached across this project's requirements. Upload happens on each credit's requirements."
      />
      <ProjectTabs projectId={id} />

      {evidence.length === 0 ? (
        <EmptyState
          title="No evidence uploaded yet"
          description="Open a credit and attach evidence files to its requirements — they'll all be listed here."
          icon={<FileIcon width={28} height={28} />}
          action={
            <Link
              href={`/projects/${id}/credits`}
              className={primaryButtonClass}
            >
              Go to credits
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {evidence.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileIcon width={18} height={18} />
                  </span>
                  <div>
                    {/* The filename was plain text: nothing in the app served a
                        stored evidence file back. It is now a link. */}
                    <a
                      href={`/api/evidence/${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
                    >
                      {e.fileName}
                    </a>
                    <div className="text-sm text-slate-500">
                      {[
                        formatFileSize(e.fileSize),
                        formatUploadedAt(e.createdAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · attached to requirement #{e.requirementSeq}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/projects/${id}/credits/${e.creditCode}`}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {e.creditCode} {e.creditTitle} →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageChrome>
  );
}
