import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getLoginSubtitle } from "@/lib/i18n/auth-messages";
import { getRequestLocale } from "@/lib/i18n/locale";

export default async function LoginPage() {
  const [context, locale] = await Promise.all([
    getCurrentAuthContext(),
    getRequestLocale(),
  ]);

  if (context?.profile.is_active) {
    if (context.profile.is_system_admin || context.membership?.is_active) {
      redirect("/dashboard");
    }

    redirect("/no-organization-access");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-6 py-16 text-text-primary">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-8 raised-shadow">
        <div className="mb-8 space-y-2">
          <p className="text-label uppercase tracking-[0.2em] text-primary">
            Waldhaus
          </p>
          <h1 className="text-page-title">Login</h1>
          <p className="text-body text-text-secondary">
            {getLoginSubtitle(locale)}
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}