import { PageChrome, PageHeader } from "../_components/PageChrome";
import { NotInSlice } from "@/components/EmptyState";

export default function TaskBoardPage() {
  return (
    <PageChrome crumbs={[{ label: "Home", href: "/dashboard" }, { label: "Task Board" }]}>
      <PageHeader title="Task Board" />
      <NotInSlice name="Task Board" />
    </PageChrome>
  );
}
