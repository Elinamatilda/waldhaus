import { notFound } from "next/navigation";
import {
  Card,
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
import { assertSalesSchemaReady, getCustomerById, getCustomerSalesAnalytics } from "@/lib/sales/service";

function currency(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams?: Promise<{ org?: string; year?: string }>;
}) {
  const locale = await getRequestLocale();
  const resolvedParams = await params;
  const resolvedSearch = (await searchParams) ?? {};
  const year = Number(resolvedSearch.year ?? new Date().getFullYear());
  const months = salesMonthLabels(locale);
  const scope = await resolveSalesScope();
  const schema = await assertSalesSchemaReady();

  if (!scope.organizationId) {
    return (
      <EmptyState
        title={tSales(locale, "sales.noData")}
        description={tSales(locale, "org.select")}
      />
    );
  }

  if (!schema.ready) {
    return <EmptyState title={tSales(locale, "sales.schemaMissing")} description={schema.message} />;
  }

  const customer = await getCustomerById(scope.organizationId, resolvedParams.customerId);

  if (!customer) {
    notFound();
  }

  const analytics = await getCustomerSalesAnalytics(scope.organizationId, customer.id, year);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.customers")}
        title={customer.name}
        description={`${tSales(locale, "sales.code")}: ${customer.customer_code ?? "-"}`}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label={tSales(locale, "sales.revenue")} value={currency(analytics.totalRevenue)} />
        <MetricCard label={tSales(locale, "sales.volume")} value={analytics.totalVolume.toFixed(2)} hint="m3" />
        <MetricCard
          label={tSales(locale, "sales.avgPrice")}
          value={analytics.avgUnitPrice == null ? "-" : currency(analytics.avgUnitPrice)}
        />
        <MetricCard
          label={tSales(locale, "sales.status")}
          value={customer.is_active ? tSales(locale, "sales.active") : tSales(locale, "sales.archived")}
        />
      </section>

      <Card className="p-0 overflow-hidden">
        <div className="p-4">
          <SectionHeader title={tSales(locale, "sales.monthlyTrend")} />
        </div>
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
            {analytics.trend.map((row, index) => (
              <TableRow key={row.month}>
                <TableCell>{months[index] ?? String(row.month)}</TableCell>
                <TableCell className="text-right">{currency(row.budget)}</TableCell>
                <TableCell className="text-right">{currency(row.forecast)}</TableCell>
                <TableCell className="text-right">{currency(row.actual)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <SectionHeader title={tSales(locale, "sales.notes")} />
        <p className="text-body text-text-secondary">{customer.notes ?? "-"}</p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4">
          <SectionHeader title={tSales(locale, "sales.byProduct")} />
        </div>
        {analytics.products.length === 0 ? (
          <div className="p-4">
            <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">{tSales(locale, "sales.product")}</th>
                <th className="px-4 py-3 text-right">{tSales(locale, "sales.revenue")}</th>
              </tr>
            </TableHeader>
            <TableBody>
              {analytics.products.map((product) => (
                <TableRow key={product.name}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-right">{currency(product.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
