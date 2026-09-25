import {
  EmptyState,
  MetricCard,
  PageHeader,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { getRequestLocale } from "@/lib/i18n/locale";
import { salesMonthLabels, tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import { assertSalesSchemaReady, getOverviewData } from "@/lib/sales/service";
import { resolveSalesSearchParams } from "@/lib/sales/search-params";

function currency(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

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
  const months = salesMonthLabels(locale);

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={tSales(locale, "sales.budget")} value={currency(overview.budgetRevenue)} />
        <MetricCard label={tSales(locale, "sales.forecast")} value={currency(overview.forecastRevenue)} />
        <MetricCard label={tSales(locale, "sales.actual")} value={currency(overview.actualRevenue)} />
        <MetricCard
          label={tSales(locale, "sales.avgPrice")}
          value={overview.avgUnitPrice == null ? "-" : currency(overview.avgUnitPrice)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <SectionHeader title={tSales(locale, "sales.monthlyTrend")} />
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">{tSales(locale, "sales.month")}</th>
                <th className="px-4 py-3 text-right">{tSales(locale, "sales.budget")}</th>
                <th className="px-4 py-3 text-right">{tSales(locale, "sales.forecast")}</th>
                <th className="px-4 py-3 text-right">{tSales(locale, "sales.actual")}</th>
              </tr>
            </TableHeader>
            <TableBody>
              {overview.monthlyTrend.map((row, index) => (
                <TableRow key={row.month}>
                  <TableCell>{months[index] ?? String(row.month)}</TableCell>
                  <TableCell className="text-right">{currency(row.budget)}</TableCell>
                  <TableCell className="text-right">{currency(row.forecast)}</TableCell>
                  <TableCell className="text-right">{currency(row.actual)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <SectionHeader title={tSales(locale, "sales.volume")} />
          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard label={tSales(locale, "sales.volume")} value={overview.annualVolume.toFixed(2)} hint="m3" />
            <MetricCard label={`${tSales(locale, "sales.actual")} m3`} value={overview.volumeActual.toFixed(2)} hint="m3" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <SectionHeader title={tSales(locale, "sales.byCustomer")} />
          {overview.topCustomers.length === 0 ? (
            <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <th className="px-4 py-3 text-left">{tSales(locale, "sales.customer")}</th>
                  <th className="px-4 py-3 text-right">{tSales(locale, "sales.revenue")}</th>
                </tr>
              </TableHeader>
              <TableBody>
                {overview.topCustomers.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right">{currency(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <SectionHeader title={tSales(locale, "sales.byProduct")} />
          {overview.topProducts.length === 0 ? (
            <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <th className="px-4 py-3 text-left">{tSales(locale, "sales.product")}</th>
                  <th className="px-4 py-3 text-right">{tSales(locale, "sales.revenue")}</th>
                </tr>
              </TableHeader>
              <TableBody>
                {overview.topProducts.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right">{currency(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-raised p-4">
        <SectionHeader title={tSales(locale, "sales.mix")} />
        {overview.customerProductMix.length === 0 ? (
          <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">{tSales(locale, "sales.customer")}</th>
                <th className="px-4 py-3 text-left">{tSales(locale, "sales.product")}</th>
                <th className="px-4 py-3 text-right">{tSales(locale, "sales.revenue")}</th>
              </tr>
            </TableHeader>
            <TableBody>
              {overview.customerProductMix.map((row) => (
                <TableRow key={`${row.customer}:${row.product}`}>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>{row.product}</TableCell>
                  <TableCell className="text-right">{currency(row.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
