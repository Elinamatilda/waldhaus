import { Card, EmptyState, PageHeader } from '@/components/ui';
import { CustomersManager } from '@/components/sales/customers-manager';
import { CustomerAnalysisView } from '@/components/sales/customer-analysis-view';
import { CustomerAnalysisFilterBar } from '@/components/sales/customer-analysis-filters';
import { getRequestLocale } from '@/lib/i18n/locale';
import { tApp } from '@/lib/i18n/app-ui';
import { loadCustomerAnalysis } from '@/lib/sales/customer-analysis-service';

export default async function SalesCustomersPage({ searchParams }: { searchParams?: Promise<{ year?: string | string[]; scenario?: string | string[]; q?: string; expand?: string }> }) {
  const [locale, params] = await Promise.all([getRequestLocale(), searchParams]);
  const currentYear = new Date().getUTCFullYear();
  const result = await loadCustomerAnalysis(params ?? {}, currentYear);
  const filters = result.kind === 'invalid' ? { year: currentYear, scenario: 'BUDGET' as const, currency: 'EUR' as const } : result.filters;
  const organizationName = result.scope.organizations.find(row => row.id === result.scope.organizationId)?.name;
  return <div className="min-w-0 space-y-6">
    <PageHeader eyebrow={tApp(locale, 'sales.group')} title={tApp(locale, 'customerAnalysis.title')} description={organizationName} />
    <CustomerAnalysisFilterBar filters={filters} locale={locale} />
    {result.kind === 'invalid' ? <EmptyState title={tApp(locale, 'sales.noData')} description={tApp(locale, 'customerAnalysis.invalid')} /> : result.kind === 'no-organization' ? <EmptyState title={tApp(locale, 'org.select')} description={tApp(locale, 'org.switch')} /> : <>
      {result.data ? <CustomerAnalysisView key={`${result.scope.organizationId}:${filters.year}:${filters.scenario}:${locale}`} data={result.data} locale={locale} expandedCustomerId={result.expandedCustomerId} productRows={result.productRows} initialSearch={typeof params?.q === 'string' ? params.q : ''} /> : <EmptyState title={tApp(locale, 'sales.noData')} description={tApp(locale, `customerAnalysis.${result.error}`)} />}
      <Card className="min-w-0"><details>
        <summary className="cursor-pointer rounded-sm text-component-heading text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-focus-ring">{tApp(locale, 'customerAnalysis.master')}</summary>
        <div className="mt-4 space-y-4">{result.customers ? <CustomersManager locale={locale} rows={result.customers} organizationId={result.scope.organizationId!} isSystemAdmin={result.scope.isSystemAdmin} year={filters.year} scenario={filters.scenario} /> : <p className="text-body-small text-text-secondary">{tApp(locale, 'customerAnalysis.masterUnavailable')}</p>}</div>
      </details></Card>
    </>}
  </div>;
}
