import { PageChrome, PageHeader } from "../_components/PageChrome";
import { NotInSlice } from "@/components/EmptyState";

export default function DepartmentsPage() {
  return (
    <PageChrome crumbs={[{ label: "Home" }, { label: "Departments" }]}>
      <PageHeader title="Departments" />
      <NotInSlice name="Departments" />
    </PageChrome>
  );
}
