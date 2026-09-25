"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { selectOrganizationAction } from "@/app/actions/organization-context";
import { Button, Select } from "@/components/ui";
import type { ClientLocale } from "@/lib/i18n/client-locale";
import { tSales } from "@/lib/i18n/sales-ui";

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

export function OrganizationSwitcher({
  locale,
  organizations,
  selectedOrganizationId,
}: {
  locale: ClientLocale;
  organizations: OrganizationOption[];
  selectedOrganizationId: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

  return (
    <form action={selectOrganizationAction} className="mt-4 space-y-2 px-2">
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <p className="text-label-small uppercase tracking-wide text-text-muted">
        {tSales(locale, "org.label")}
      </p>
      <Select name="organization_id" defaultValue={selectedOrganizationId ?? ""} className="w-full">
        <option value="">{tSales(locale, "org.select")}</option>
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary" className="w-full">
        {tSales(locale, "org.switch")}
      </Button>
    </form>
  );
}