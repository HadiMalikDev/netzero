import { PageChrome, PageHeader } from "../_components/PageChrome";
import { NotInSlice } from "@/components/EmptyState";

export default function NotificationsPage() {
  return (
    <PageChrome crumbs={[{ label: "Home" }, { label: "Notifications" }]}>
      <PageHeader title="Notifications" />
      <NotInSlice name="Notifications" />
    </PageChrome>
  );
}
