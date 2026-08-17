import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { LeafIcon } from "@/components/icons";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / marketing panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">
            <LeafIcon width={20} height={20} />
          </span>
          <div>
            <div className="text-lg font-semibold leading-tight">NetZero</div>
            <div className="text-xs text-slate-400">Mostadam Compliance</div>
          </div>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight">
            Upload a manual.
            <br />
            Track every credit.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Turn a Mostadam spec PDF into a live checklist, attach evidence, and
            ask a grounded assistant what&rsquo;s left — answered only from your
            project&rsquo;s own data, with citations.
          </p>
          <div className="mt-8 flex gap-3">
            {["Real PDF extraction", "Grounded AI", "Evidence tracking"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200 ring-1 ring-white/10"
                >
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Mostadam-only · Commercial &amp; Residential · English
        </p>
      </div>

      {/* Sign-in form */}
      <div className="flex items-center justify-center bg-canvas p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
              <LeafIcon width={22} height={22} />
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back. Enter your credentials to continue.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
