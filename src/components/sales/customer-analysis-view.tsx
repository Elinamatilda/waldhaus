import { Card, EmptyState, MetricCard, SectionHeader } from '@/components/ui';
import { CustomerSalesDonut } from './customer-sales-share';
import { CustomerMonthlyChart } from './customer-monthly-chart';
import { CustomerAnalysisTable } from './customer-analysis-table';
import { money, percent } from '@/lib/dashboard/format';
import { tApp } from '@/lib/i18n/app-ui';
import type { AppLocale } from '@/lib/i18n/config';
import type { CustomerAnalysisData, CustomerProductAnalysisRow } from '@/lib/sales/customer-analysis';

export function CustomerAnalysisView({ data, locale, initialSearch, expandedCustomerId = null, productRows = null }: { data: CustomerAnalysisData; locale: AppLocale; initialSearch?: string; expandedCustomerId?: string | null; productRows?: CustomerProductAnalysisRow[] | null }) {
  const cards = [
    { label: tApp(locale, 'customerAnalysis.totalSales'), value: money(locale, data.totalSales, true), exact: money(locale, data.totalSales) },
    { label: tApp(locale, 'customerAnalysis.customerCount'), value: String(data.customerCount), exact: String(data.customerCount) },
    { label: tApp(locale, 'customerAnalysis.largestCustomer'), value: data.largestCustomer?.customerName ?? '—', exact: data.largestCustomer?.customerName ?? '—' },
    { label: tApp(locale, 'customerAnalysis.largestShare'), value: percent(locale, data.largestCustomerShare), exact: percent(locale, data.largestCustomerShare) },
    { label: tApp(locale, 'customerAnalysis.top3Share'), value: percent(locale, data.top3Share), exact: percent(locale, data.top3Share) },
    { label: tApp(locale, 'customerAnalysis.averageMonthly'), value: money(locale, data.averageMonthlySales, true), exact: money(locale, data.averageMonthlySales) },
  ];
  return <>
    {data.excludedCurrencies.length ? <p className="text-body-small text-warning">{tApp(locale, 'customerAnalysis.excluded').replace('{currencies}', data.excludedCurrencies.join(', '))}</p> : null}
    <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{cards.map(card => <div key={card.label} className="min-w-0 break-words" title={`${card.label}: ${card.exact}`}><MetricCard label={card.label} value={card.value} /><span className="sr-only">{card.exact}</span></div>)}</section>
    <p className="text-body-small text-text-secondary">{tApp(locale, 'customerAnalysis.countDefinition')}</p>
    {data.totalSales === null ? <EmptyState title={tApp(locale, 'sales.noData')} description={tApp(locale, 'customerAnalysis.empty')} /> : <>
      <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0"><SectionHeader title={tApp(locale, 'customerAnalysis.distribution')} description={tApp(locale, 'customerAnalysis.currency')} /><CustomerSalesDonut data={data.share.slices} total={data.totalSales} renderable={data.share.renderable} locale={locale} title={tApp(locale, 'customerAnalysis.distribution')} totalLabel={tApp(locale, 'customerAnalysis.totalSales')} /></Card>
        <Card className="min-w-0"><SectionHeader title={tApp(locale, 'customerAnalysis.monthly')} description={tApp(locale, 'customerAnalysis.monthlyDescription')} /><CustomerMonthlyChart data={data} locale={locale} /></Card>
      </section>
      <CustomerAnalysisTable data={data} locale={locale} initialSearch={initialSearch} expandedCustomerId={expandedCustomerId} productRows={productRows} />
    </>}
  </>;
}
