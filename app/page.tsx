import { redirect } from "next/navigation";

export default function RootPage() {
  // The (app) layout guards auth and bounces to /login when signed out.
  redirect("/dashboard");
}
