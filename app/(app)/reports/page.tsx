import { PageChrome, PageHeader } from "../_components/PageChrome";
import { NotInSlice } from "@/components/EmptyState";

export default function ReportsPage() {
  return (
    <PageChrome crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Reports" }]}>
      <PageHeader title="Reports" />
      <NotInSlice name="Reports" />
    </PageChrome>
  );
}
