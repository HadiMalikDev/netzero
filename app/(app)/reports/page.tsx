import { ProjectResolverPage } from "../_components/ProjectResolverPage";

/** Top-level "Reports" resolves to the current project's Reports screen. */
export default function ReportsResolverPage() {
  return <ProjectResolverPage title="Reports" subpath="reports" />;
}
