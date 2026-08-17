import { ProjectResolverPage } from "../_components/ProjectResolverPage";

/** Top-level "Documents" resolves to the current project's scoped Documents screen. */
export default function DocumentsResolverPage() {
  return <ProjectResolverPage title="Documents" subpath="documents" />;
}
