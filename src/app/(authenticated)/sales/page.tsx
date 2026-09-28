import { EmptyState, PageHeader } from "@/components/ui";
import { SalesReportView } from "@/components/sales/report";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import { assertSalesSchemaReady, getOverviewData } from "@/lib/sales/service";
import { resolveSalesSearchParams } from "@/lib/sales/search-params";

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string; year?: string }>;
}) {
  const params = await resolveSalesSearchParams(searchParams);
  const locale = await getRequestLocale();
  const year = Number(params.year ?? new Date().getFullYear());
  const scope = await resolveSalesScope();
  const schema = await assertSalesSchemaReady();

  if (!scope.organizationId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={tSales(locale, "sales.group")}
          title={tSales(locale, "sales.overview")}
          description={tSales(locale, "org.select")}
        />
        <EmptyState title={tSales(locale, "org.select")} description={tSales(locale, "org.switch")} />
      </div>
    );
  }

  if (!schema.ready) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={tSales(locale, "sales.group")}
          title={tSales(locale, "sales.overview")}
          description={tSales(locale, "sales.schemaMissing")}
        />
        <EmptyState title={tSales(locale, "sales.schemaMissing")} description={schema.message} />
      </div>
    );
  }

  const overview = await getOverviewData(scope.organizationId, year);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.group")}
        title={tSales(locale, "sales.overview")}
        description={`${tSales(locale, "sales.year")}: ${year}`}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex items-end gap-2" method="get" action="">
          {scope.isSystemAdmin ? <input type="hidden" name="org" value={scope.organizationId} /> : null}
          <label className="text-label text-text-secondary">{tSales(locale, "sales.year")}</label>
          <input
            className="h-9 w-28 rounded-lg border border-border bg-surface-raised px-3 text-body"
            name="year"
            type="number"
            min={2020}
            max={2100}
            defaultValue={year}
          />
          <button className="h-9 rounded-lg border border-border bg-surface-subtle px-3 text-label" type="submit">
            {tSales(locale, "sales.save")}
          </button>
        </form>
      </div>

      <SalesReportView report={overview} locale={locale} />
    </div>
  );
}
