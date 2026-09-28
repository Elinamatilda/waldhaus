import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { CustomerAnalysisFilterBar } from '@/components/sales/customer-analysis-filters';
import { customerAnalysisFilters, scopedCustomerReport } from '@/lib/sales/customer-analysis';
import { customerSalesLink } from '@/lib/sales/customer-share';
import { tApp } from '@/lib/i18n/app-ui';
import { SalesReportView } from "@/components/sales/report";
import { notFound } from "next/navigation";
import {
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
} from "@/components/ui";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import { assertSalesSchemaReady, getCustomerById, getCustomerSalesAnalytics } from "@/lib/sales/service";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
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

  const customer = await getCustomerById(scope.organizationId, resolvedParams.customerId);

  if (!customer) {
    notFound();
  }

  const analytics = await getCustomerSalesAnalytics(scope.organizationId, customer.id, filters.year);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.customers")}
        title={customer.name}
        description={`${tSales(locale, "sales.code")}: ${customer.customer_code ?? "-"}`}
      />

      <Link className="text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring" href={customerSalesLink(filters.year, null, filters.scenario)}>{tApp(locale, 'customerAnalysis.back')}</Link>
      <CustomerAnalysisFilterBar filters={filters} locale={locale} />
      {analytics.totals.some(row => row.scenario === filters.scenario && row.currency_code !== 'EUR') ? <p className="text-body-small text-warning">{tApp(locale, 'customerAnalysis.excluded').replace('{currencies}', [...new Set(analytics.totals.filter(row => row.scenario === filters.scenario && row.currency_code !== 'EUR').map(row => row.currency_code))].join(', '))}</p> : null}
      <div className="max-w-full overflow-x-auto"><SalesReportView report={scopedCustomerReport(analytics, filters)} locale={locale} /></div>
      <Card>
        <SectionHeader title={tSales(locale, "sales.status")} />
        <p>{customer.is_active ? tSales(locale,"sales.active") : tSales(locale,"sales.archived")}</p>
      </Card>
      <Card>
        <SectionHeader title={tSales(locale, "sales.notes")} />
        <p className="text-body text-text-secondary">{customer.notes ?? "-"}</p>
      </Card>

    </div>
  );
}
