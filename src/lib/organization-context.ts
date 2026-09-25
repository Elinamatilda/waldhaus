import "server-only";

import { cookies } from "next/headers";
import { forbidden } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import type { AccessRole, Organization } from "@/lib/auth/types";

export const SELECTED_ORGANIZATION_COOKIE = "waldhaus-selected-organization";

export type OrganizationOption = Pick<Organization, "id" | "name" | "slug">;

export type OrganizationContext = {
  role: AccessRole;
  isSystemAdmin: boolean;
  organizations: OrganizationOption[];
  selectedOrganizationId: string | null;
  selectedOrganization: OrganizationOption | null;
};

export async function getOrganizationContext(): Promise<OrganizationContext> {
  const context = await requireProfile();

  if (!context.profile.is_system_admin) {
    if (!context.membership?.organization) {
      forbidden();
    }

    return {
      role: context.membership.role,
      isSystemAdmin: false,
      organizations: [
        {
          id: context.membership.organization.id,
          name: context.membership.organization.name,
          slug: context.membership.organization.slug,
        },
      ],
      selectedOrganizationId: context.membership.organization.id,
      selectedOrganization: {
        id: context.membership.organization.id,
        name: context.membership.organization.name,
        slug: context.membership.organization.slug,
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load organizations: ${error.message}`);
  }

  const organizations = (data ?? []) as OrganizationOption[];
  const cookieStore = await cookies();
  const preferredId = cookieStore.get(SELECTED_ORGANIZATION_COOKIE)?.value ?? null;
  const selectedOrganization = organizations.find((organization) => organization.id === preferredId) ?? null;

  return {
    role: "system_admin",
    isSystemAdmin: true,
    organizations,
    selectedOrganizationId: selectedOrganization?.id ?? null,
    selectedOrganization,
  };
}