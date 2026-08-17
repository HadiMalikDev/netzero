import { ProjectResolverPage } from "../_components/ProjectResolverPage";

/** Top-level "AI Assistant" resolves to the current project's scoped screen. */
export default function AssistantResolverPage() {
  return <ProjectResolverPage title="AI Assistant" subpath="assistant" />;
}
