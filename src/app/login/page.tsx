import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function LoginPage() {
  const profile = await getCurrentProfile();

  if (profile?.is_active) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-950">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8 space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Waldhaus
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
          <p className="text-sm leading-6 text-zinc-600">
            Sign in with your employee account to access the internal tools.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}