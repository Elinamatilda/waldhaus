import { tSales } from "@/lib/i18n/sales-ui";
import type { AppLocale } from "@/lib/i18n/locale";
import { Button, Select } from "@/components/ui";

export function OrganizationScopeForm({
  locale,
  value,
  organizations,
}: {
  locale: AppLocale;
  value: string | null;
  organizations: Array<{ id: string; name: string; slug: string }>;
}) {
  if (organizations.length === 0) {
    return null;
  }

  return (
    <form className="flex items-end gap-2" action="" method="get">
      <label className="text-label text-text-secondary">
        {tSales(locale, "sales.selectOrganization")}
      </label>
      <Select name="org" defaultValue={value ?? organizations[0]?.id} className="min-w-52">
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="secondary">
        {tSales(locale, "sales.save")}
      </Button>
    </form>
  );
}
