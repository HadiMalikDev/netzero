import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../_components/PageChrome";
import { ProjectTabs } from "../_components/ProjectTabs";
import { getProject } from "@/lib/data";
import { Chat } from "./Chat";

export default async function AssistantPage({
  params,
}: PageProps<"/projects/[id]/assistant">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "AI Assistant" },
      ]}
    >
      <PageHeader
        title="AI Assistant"
        subtitle={`Grounded aggregator over ${project.name} — cites its sources, never invents.`}
      />
      <ProjectTabs projectId={id} />
      <Chat projectId={id} />
    </PageChrome>
  );
}
