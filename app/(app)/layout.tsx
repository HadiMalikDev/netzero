import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { Sidebar } from "./_components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={user.name} />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
