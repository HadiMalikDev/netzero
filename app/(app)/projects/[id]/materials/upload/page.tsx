import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../_components/PageChrome";
import { getProject } from "@/lib/data";
import { uploadSubmittalAction } from "../../../material-actions";
import { UploadQueue } from "./UploadQueue";

/**
 * Upload a material submittal (client review Rev 01, 1.2, D44): only the
 * files, one product at a time, submitted together.
 */
export default async function UploadSubmittalPage({ params }: PageProps<"/projects/[id]/materials/upload">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const base = `/projects/${id}/materials`;
  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Materials", href: base },
        { label: "Upload submittal" },
      ]}
    >
      <PageHeader
        title="Upload material submittal"
        subtitle="Add each product's data sheets, BOQ extract and SMQ pages, one product at a time, then submit them together. Each product gets its own questionnaire and review."
        action={
          <Link href={base} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← Materials
          </Link>
        }
      />
      <UploadQueue projectId={id} action={uploadSubmittalAction} />
    </PageChrome>
  );
}
