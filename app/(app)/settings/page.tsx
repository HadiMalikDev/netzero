import { PageChrome, PageHeader } from "../_components/PageChrome";
import { NotInSlice } from "@/components/EmptyState";

export default function SettingsPage() {
  return (
    <PageChrome crumbs={[{ label: "Home" }, { label: "Settings" }]}>
      <PageHeader title="Settings" />
      <NotInSlice name="Settings" />
    </PageChrome>
  );
}
