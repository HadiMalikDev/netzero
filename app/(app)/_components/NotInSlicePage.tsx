import { PageChrome, PageHeader } from "./PageChrome";
import { NotInSlice } from "@/components/EmptyState";

/** A top-level nav entry that isn't part of the current build slice yet. */
export function NotInSlicePage({ title }: { title: string }) {
  return (
    <PageChrome crumbs={[{ label: "Home", href: "/dashboard" }, { label: title }]}>
      <PageHeader title={title} />
      <NotInSlice name={title} />
    </PageChrome>
  );
}
