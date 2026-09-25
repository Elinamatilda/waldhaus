import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/session";

export default async function NoOrganizationAccessPage() {
  const context = await getCurrentAuthContext();

  if (!context || !context.profile.is_active) {
    redirect("/login");
  }

  if (context.profile.is_system_admin || context.membership?.is_active) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-6 py-16 text-text-primary">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-8 raised-shadow">
        <h1 className="text-section-title">No organization access</h1>
        <p className="mt-3 text-body text-text-secondary">
          Authentication succeeded, but your account is not assigned to an active organization.
        </p>
        <p className="mt-2 text-body text-text-secondary">
          Contact a Waldhaus administrator to request organization access.
        </p>
      </div>
    </main>
  );
}
