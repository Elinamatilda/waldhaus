import Link from "next/link";
import { Suspense } from "react";
import { ProductsManager } from "@/components/sales/products-manager";
import { tProduct } from "@/lib/i18n/product-master-ui";
import { requireRole } from '@/lib/auth/session';
import { CustomerAnalysisFilterBar } from '@/components/sales/customer-analysis-filters';
import { customerAnalysisFilters, scopedCustomerReport } from '@/lib/sales/customer-analysis';
import { ProductMasterManager } from "@/components/sales/product-master-manager";
import { getProductMasterDefinition, loadProductLookups, productMasterReady } from "@/lib/products/service";
import { tApp } from "@/lib/i18n/app-ui";
import { SalesReportView } from "@/components/sales/report";
import { notFound } from "next/navigation";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import {
  assertSalesSchemaReady,
  getProductById,
  getProductSalesAnalytics,
  listCustomers,
} from "@/lib/sales/service";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<{ org?: string; year?: string | string[]; scenario?: string | string[] }>;
}) {
  await requireRole('admin');
  const locale = await getRequestLocale();
  const resolvedParams = await params;
  const resolvedSearch = (await searchParams) ?? {};
  let filters;
  try { filters = customerAnalysisFilters(resolvedSearch, new Date().getUTCFullYear()); } catch { return <EmptyState title={tSales(locale, 'sales.noData')} description={tApp(locale, 'customerAnalysis.invalid')} />; }
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

  const ready = await productMasterReady(scope.organizationId);
  const [definition, lookups, customers] = ready ? await Promise.all([
    getProductMasterDefinition(scope.organizationId, product.id, locale),
    loadProductLookups(scope.organizationId), listCustomers(scope.organizationId),
  ]) : [null, null, []];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.products")}
        title={product.name}
        description={`${tSales(locale, "sales.code")}: ${product.product_code ?? "-"}`}
      />

      <Link className="text-primary hover:underline" href="/sales/products">{tProduct(locale, 'backProducts')}</Link>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={product.is_active ? 'success' : 'neutral'}>{tSales(locale, product.is_active ? 'sales.active' : 'sales.archived')}</StatusBadge>
          <ProductsManager detailOnly locale={locale} rows={[product]} organizationId={scope.organizationId} isSystemAdmin={scope.isSystemAdmin} />
        </div>
        <p className="text-body text-text-secondary">{product.description ?? '—'}</p>
      </Card>
      {definition && lookups ? <ProductMasterManager key={`${scope.organizationId}:${product.id}`} organizationId={scope.organizationId} locale={locale} definition={definition} lookups={lookups} customers={customers} /> : <EmptyState title={tApp(locale, 'productMaster.unavailable')} description={tProduct(locale, 'unavailable')} />}
      <details>
        <summary className="cursor-pointer text-section-title">{tProduct(locale, 'salesAnalysis')}</summary>
        <Suspense fallback={<p>…</p>}>
          <ProductSalesAnalysis organizationId={scope.organizationId} productId={product.id} filters={filters} locale={locale} />
        </Suspense>
      </details>
    </div>
  );
}

async function ProductSalesAnalysis({organizationId, productId, filters, locale}: {
  organizationId: string; productId: string; filters: ReturnType<typeof customerAnalysisFilters>;
  locale: Awaited<ReturnType<typeof getRequestLocale>>;
}) {
  let analytics;
  try {
    analytics = await getProductSalesAnalytics(organizationId, productId, filters.year);
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    return <EmptyState title={tProduct(locale, 'salesAnalysis')} description={tProduct(locale, 'salesUnavailable')} />;
  }
  const excluded = [...new Set(analytics.totals.filter(row => row.scenario === filters.scenario && row.currency_code !== 'EUR').map(row => row.currency_code))];
  return <div className="space-y-4 py-4">
    <CustomerAnalysisFilterBar filters={filters} locale={locale} />
    {excluded.length ? <p className="text-body-small text-warning">{tApp(locale, 'customerAnalysis.excluded').replace('{currencies}', excluded.join(', '))}</p> : null}
    <div className="max-w-full overflow-x-auto"><SalesReportView report={scopedCustomerReport(analytics, filters)} locale={locale} /></div>
  </div>;
}
