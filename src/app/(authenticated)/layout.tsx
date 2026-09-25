import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth/session";
import { getOrganizationContext } from "@/lib/organization-context";
import type { AccessRole } from "@/lib/auth/types";

type AuthenticatedLayoutProps = {
  children: ReactNode;
};

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const [{ profile, user, membership }, organizationContext] = await Promise.all([
    requireProfile(),
    getOrganizationContext(),
  ]);

  let role: AccessRole;

  if (profile.is_system_admin) {
    role = "system_admin";
  } else if (membership?.is_active) {
    role = membership.role;
  } else {
    redirect("/no-organization-access");
  }

  const fallback = user.email?.slice(0, 2).toUpperCase() ?? "WU";
  const initials =
    profile.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || fallback;

  return (
    <AppShell
      role={role}
      userInitials={initials}
      organizationContext={{
        isSystemAdmin: organizationContext.isSystemAdmin,
        organizations: organizationContext.organizations,
        selectedOrganizationId: organizationContext.selectedOrganizationId,
        selectedOrganizationName: organizationContext.selectedOrganization?.name ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}