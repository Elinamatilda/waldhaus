import { EmptyState, PageHeader } from "@/components/ui";
import { upsertActualsGridAction } from "@/app/(authenticated)/sales/actions";
import { MonthlyFactsGrid } from "@/components/sales/monthly-facts-grid";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import {
  assertSalesSchemaReady,
  getScenarioByCode,
  listCustomers,
  listProducts,
  listVariants,
  loadPlanningGridRows,
} from "@/lib/sales/service";
import { resolveSalesSearchParams } from "@/lib/sales/search-params";

export default async function SalesActualsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    org?: string;
    year?: string;
    customer?: string;
    product?: string;
    variant?: string;
  }>;
}) {
  const params = await resolveSalesSearchParams(searchParams);
  const locale = await getRequestLocale();
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

  const year = Number(params.year ?? new Date().getFullYear());
  const actualScenario = await getScenarioByCode(scope.organizationId, "ACTUAL");
  if (!actualScenario) {
    return <EmptyState title={tSales(locale, "sales.noData")} description="ACTUAL scenario is missing." />;
  }

  const customers = (await listCustomers(scope.organizationId)).filter((customer) => customer.is_active);
  const products = (await listProducts(scope.organizationId)).filter((product) => product.is_active);

  const customerId = params.customer ?? customers[0]?.id ?? "";
  const productId = params.product ?? products[0]?.id ?? "";
  const variants = productId ? await listVariants(scope.organizationId, productId) : [];
  const variantId = params.variant ?? "";

  if (!customerId || !productId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={tSales(locale, "sales.group")}
          title={tSales(locale, "sales.actuals")}
          description={tSales(locale, "sales.actualsManual")}
        />
        <EmptyState title={tSales(locale, "sales.empty")} description="Create customer and product first." />
      </div>
    );
  }

  const rows = await loadPlanningGridRows(scope.organizationId, {
    scenarioId: actualScenario.id,
    customerId,
    productId,
    variantId,
    year,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.group")}
        title={tSales(locale, "sales.actuals")}
        description={tSales(locale, "sales.actualsManual")}
      />

      <form
        method="get"
        action=""
        className="grid gap-3 rounded-lg border border-border bg-surface-raised p-4 md:grid-cols-6"
      >
        <label className="text-label text-text-secondary" htmlFor="year">
          {tSales(locale, "sales.year")}
        </label>
        <input
          id="year"
          name="year"
          type="number"
          defaultValue={year}
          min={2020}
          max={2100}
          className="h-9 rounded-lg border border-border bg-surface-raised px-3"
        />

        <label className="text-label text-text-secondary" htmlFor="customer">
          {tSales(locale, "sales.customer")}
        </label>
        <select
          id="customer"
          name="customer"
          className="h-9 rounded-lg border border-border bg-surface-raised px-3"
          defaultValue={customerId}
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>

        <label className="text-label text-text-secondary" htmlFor="product">
          {tSales(locale, "sales.product")}
        </label>
        <select
          id="product"
          name="product"
          className="h-9 rounded-lg border border-border bg-surface-raised px-3"
          defaultValue={productId}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>

        <label className="text-label text-text-secondary" htmlFor="variant">
          {tSales(locale, "sales.variantOptional")}
        </label>
        <select
          id="variant"
          name="variant"
          className="h-9 rounded-lg border border-border bg-surface-raised px-3"
          defaultValue={variantId}
        >
          <option value="">-</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.variant_name ?? variant.variant_code ?? variant.id}
            </option>
          ))}
        </select>

        <button className="h-9 rounded-lg border border-border bg-surface-subtle px-3 text-label" type="submit">
          {tSales(locale, "sales.select")}
        </button>
      </form>

      <MonthlyFactsGrid
        locale={locale}
        action={upsertActualsGridAction}
        organizationId={scope.organizationId}
        year={year}
        customerId={customerId}
        productId={productId}
        variantId={variantId}
        rows={rows.map((row) => ({
          periodId: row.period_id,
          monthNumber: row.sales_periods?.month_number ?? 0,
          quantityValue: row.quantity_value,
          quantityUnitCode: row.quantity_unit_code,
          volumeM3: row.volume_m3,
          unitPriceAmount: row.unit_price_amount,
          pricingBasisCode: row.pricing_basis_code,
          revenueAmount: row.revenue_amount,
          currencyCode: row.currency_code,
        }))}
      />
    </div>
  );
}
