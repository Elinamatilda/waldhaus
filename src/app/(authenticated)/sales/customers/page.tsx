import { EmptyState, PageHeader } from "@/components/ui";
import { CustomersManager } from "@/components/sales/customers-manager";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import { assertSalesSchemaReady, listCustomers } from "@/lib/sales/service";
import { resolveSalesSearchParams } from "@/lib/sales/search-params";

export default async function SalesCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string; q?: string }>;
}) {
  const params = await resolveSalesSearchParams(searchParams);
  const locale = await getRequestLocale();
  const scope = await resolveSalesScope();
  const schema = await assertSalesSchemaReady();

  if (!scope.organizationId) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={tSales(locale, "sales.group")} title={tSales(locale, "sales.customers")} />
        <EmptyState title={tSales(locale, "org.select")} description={tSales(locale, "org.switch")} />
      </div>
    );
  }

  if (!schema.ready) {
    return (
      <EmptyState title={tSales(locale, "sales.schemaMissing")} description={schema.message} />
    );
  }

  const rows = await listCustomers(scope.organizationId, params.q);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.group")}
        title={tSales(locale, "sales.customers")}
        description={tSales(locale, "sales.byCustomer")}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form action="" method="get" className="flex items-end gap-2">
          {scope.isSystemAdmin ? <input type="hidden" name="org" value={scope.organizationId} /> : null}
          <label className="text-label text-text-secondary">{tSales(locale, "sales.search")}</label>
          <input
            className="h-9 min-w-56 rounded-lg border border-border bg-surface-raised px-3 text-body"
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={tSales(locale, "sales.customer")}
          />
          <button className="h-9 rounded-lg border border-border bg-surface-subtle px-3 text-label" type="submit">
            {tSales(locale, "sales.search")}
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
      ) : (
        <CustomersManager
          locale={locale}
          rows={rows}
          organizationId={scope.organizationId}
          isSystemAdmin={scope.isSystemAdmin}
        />
      )}
    </div>
  );
}
