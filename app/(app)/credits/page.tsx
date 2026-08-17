import { ProjectResolverPage } from "../_components/ProjectResolverPage";

/** Top-level "Credits" resolves to the current project's scoped Credits screen. */
export default function CreditsResolverPage() {
  return <ProjectResolverPage title="Credits" subpath="credits" />;
}
