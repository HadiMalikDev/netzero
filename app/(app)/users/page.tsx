import { PageChrome, PageHeader } from "../_components/PageChrome";
import { NotInSlice } from "@/components/EmptyState";

export default function UsersPage() {
  return (
    <PageChrome crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Users" }]}>
      <PageHeader title="Users" />
      <NotInSlice name="Users" />
    </PageChrome>
  );
}
