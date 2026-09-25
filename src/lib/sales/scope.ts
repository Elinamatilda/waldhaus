import { forbidden } from "next/navigation";
import { getOrganizationContext } from "@/lib/organization-context";

export type SalesScope = {
  organizationId: string | null;
  isSystemAdmin: boolean;
  organizations: Array<{ id: string; name: string; slug: string }>;
};

export async function resolveSalesScope() {
  const context = await getOrganizationContext();

  if (!context.isSystemAdmin && !context.selectedOrganizationId) {
    forbidden();
  }

  return {
    organizationId: context.selectedOrganizationId,
    isSystemAdmin: context.isSystemAdmin,
    organizations: context.organizations,
  } satisfies SalesScope;
}
