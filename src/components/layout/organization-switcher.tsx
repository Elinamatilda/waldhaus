"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { selectOrganizationAction } from "@/app/actions/organization-context";
import { Select } from "@/components/ui";
import type { AppLocale } from "@/lib/i18n/config";
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
  locale: AppLocale;
  organizations: OrganizationOption[];
  selectedOrganizationId: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnQuery = new URLSearchParams();
  const customerAnalysis = pathname === '/sales/customers' || pathname.startsWith('/sales/customers/');
  if (pathname === '/dashboard' || customerAnalysis) {
    const year = searchParams.get('year');
    if (year) returnQuery.set('year', year);
  }
  if (customerAnalysis) {
    const scenario = searchParams.get('scenario');
    if (scenario) returnQuery.set('scenario', scenario);
  }
  const returnPath = returnQuery.size ? `${pathname}?${returnQuery}` : pathname;

  return (
    <form action={selectOrganizationAction} className="mt-4 space-y-2 px-2">
      <input type="hidden" name="redirect_to" value={returnPath} />
      <label htmlFor="organization-context" className="text-label-small uppercase tracking-wide text-text-muted">
        {tSales(locale, "org.label")}
      </label>
      <OrganizationSelect locale={locale} organizations={organizations} selectedOrganizationId={selectedOrganizationId} />
    </form>
  );
}

function OrganizationSelect({ locale, organizations, selectedOrganizationId }: {
  locale: AppLocale;
  organizations: OrganizationOption[];
  selectedOrganizationId: string | null;
}) {
  const { pending } = useFormStatus();
  return (
    <Select
      id="organization-context"
      name="organization_id"
      value={selectedOrganizationId ?? ""}
      disabled={pending}
      aria-busy={pending}
      className="w-full"
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      <option value="">{tSales(locale, "org.select")}</option>
      {organizations.map((organization) => (
        <option key={organization.id} value={organization.id}>
          {organization.name}
        </option>
      ))}
    </Select>
  );
}
