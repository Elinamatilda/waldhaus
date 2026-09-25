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
import { createVariantAction } from "@/app/(authenticated)/sales/actions";
import { getRequestLocale } from "@/lib/i18n/locale";
import { salesMonthLabels, tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import {
  assertSalesSchemaReady,
  getProductById,
  getProductSalesAnalytics,
  listCustomers,
  listVariants,
} from "@/lib/sales/service";

function currency(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
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

  const product = await getProductById(scope.organizationId, resolvedParams.productId);

  if (!product) {
    notFound();
  }

  const variants = await listVariants(scope.organizationId, product.id);
  const customers = await listCustomers(scope.organizationId);
  const analytics = await getProductSalesAnalytics(scope.organizationId, product.id, year);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.products")}
        title={product.name}
        description={`${tSales(locale, "sales.code")}: ${product.product_code ?? "-"}`}
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
          value={product.is_active ? tSales(locale, "sales.active") : tSales(locale, "sales.archived")}
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
        <SectionHeader title={tSales(locale, "sales.description")} />
        <p className="text-body text-text-secondary">{product.description ?? "-"}</p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4">
          <SectionHeader title={tSales(locale, "sales.byCustomer")} />
        </div>
        {analytics.customers.length === 0 ? (
          <div className="p-4">
            <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">{tSales(locale, "sales.customer")}</th>
                <th className="px-4 py-3 text-right">{tSales(locale, "sales.revenue")}</th>
              </tr>
            </TableHeader>
            <TableBody>
              {analytics.customers.map((customer) => (
                <TableRow key={customer.name}>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell className="text-right">{currency(customer.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <SectionHeader title={tSales(locale, "sales.variant")} description={tSales(locale, "sales.variantOptional")} />
        <form action={createVariantAction} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="organization_id" value={scope.organizationId} />
          <input type="hidden" name="product_id" value={product.id} />
          <input
            name="variant_name"
            required
            className="h-9 rounded-lg border border-border bg-surface-raised px-3"
            placeholder={tSales(locale, "sales.name")}
          />
          <input
            name="variant_code"
            className="h-9 rounded-lg border border-border bg-surface-raised px-3"
            placeholder={tSales(locale, "sales.code")}
          />
          <select name="customer_id" className="h-9 rounded-lg border border-border bg-surface-raised px-3" defaultValue="">
            <option value="">{tSales(locale, "sales.variantOptional")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <input
            name="quality_code"
            className="h-9 rounded-lg border border-border bg-surface-raised px-3"
            placeholder="Quality"
          />
          <input name="thickness_mm" className="h-9 rounded-lg border border-border bg-surface-raised px-3" placeholder="Thickness mm" />
          <input name="width_mm" className="h-9 rounded-lg border border-border bg-surface-raised px-3" placeholder="Width mm" />
          <input name="depth_mm" className="h-9 rounded-lg border border-border bg-surface-raised px-3" placeholder="Depth mm" />
          <input name="length_mm" className="h-9 rounded-lg border border-border bg-surface-raised px-3" placeholder="Length mm" />
          <input name="volume_per_unit_m3" className="h-9 rounded-lg border border-border bg-surface-raised px-3" placeholder="Volume / unit m3" />
          <select name="default_quantity_unit_code" className="h-9 rounded-lg border border-border bg-surface-raised px-3" defaultValue="PIECE">
            <option value="PIECE">PIECE</option>
            <option value="LINEAR_METER">LINEAR_METER</option>
          </select>
          <button className="h-9 rounded-lg bg-primary px-3 text-label text-white" type="submit">
            {tSales(locale, "sales.create")}
          </button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4">
          <SectionHeader title={tSales(locale, "sales.variant")} description="Existing variants" />
        </div>
        {variants.length === 0 ? (
          <div className="p-4">
            <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <th className="px-4 py-3 text-left">{tSales(locale, "sales.name")}</th>
                <th className="px-4 py-3 text-left">{tSales(locale, "sales.code")}</th>
                <th className="px-4 py-3 text-left">Quality</th>
                <th className="px-4 py-3 text-left">Dimensions</th>
              </tr>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell>{variant.variant_name ?? "-"}</TableCell>
                  <TableCell>{variant.variant_code ?? "-"}</TableCell>
                  <TableCell>{variant.quality_code ?? variant.quality_label_raw ?? "-"}</TableCell>
                  <TableCell>
                    {[variant.thickness_mm, variant.width_mm, variant.depth_mm ?? variant.length_mm]
                      .filter((value) => value != null)
                      .join(" x ") || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
