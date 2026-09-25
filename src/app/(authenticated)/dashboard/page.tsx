import { logoutAction } from "@/app/actions/auth";
import { requireProfile } from "@/lib/auth/session";

export default async function DashboardPage() {
  const { profile, user } = await requireProfile();
  const displayName = profile.full_name?.trim() || user.email || "Unknown user";

  return (
    <main className="flex min-h-screen bg-zinc-50 px-6 py-16 text-zinc-950">
      <section className="mx-auto w-full max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              Waldhaus
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="max-w-xl text-sm leading-6 text-zinc-600">
              The authentication and authorization foundation is active. More operational and administrative tools can be added on top of this protected route group.
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition hover:border-zinc-950"
            >
              Log out
            </button>
          </form>
        </div>

        <dl className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Name
            </dt>
            <dd className="mt-2 text-base font-medium text-zinc-950">
              {displayName}
            </dd>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Email
            </dt>
            <dd className="mt-2 text-base font-medium text-zinc-950">
              {user.email ?? "No email available"}
            </dd>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Role
            </dt>
            <dd className="mt-2 text-base font-medium capitalize text-zinc-950">
              {profile.role}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}