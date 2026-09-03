import { ProjectResolverPage } from "../_components/ProjectResolverPage";

/** Top-level "Credits" resolves to the current project's scoped Credits screen. */
export default async function CreditsResolverPage({
  searchParams,
}: PageProps<"/credits">) {
  return (
    <ProjectResolverPage
      title="Credits"
      subpath="credits"
      searchParams={await searchParams}
    />
  );
}
