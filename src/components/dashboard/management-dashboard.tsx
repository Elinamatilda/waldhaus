import type { ReactNode } from 'react';
import { Card, MetricCard, SectionHeader } from '@/components/ui';
import type { Completeness, DashboardData } from '@/lib/dashboard/model';
import type { AppLocale } from '@/lib/i18n/config';
import { tApp } from '@/lib/i18n/app-ui';
import { money, monthName, percent } from '@/lib/dashboard/format';
import { CustomerSalesDonut, LiquidityOutlookChart, MonthlyCostsChart, ProfitabilityChart } from './charts';

function sourceHint(source: Completeness, locale: AppLocale) {
  return source.state !== 'ready' ? tApp(locale, `dashboard.${source.state}`) : source.missing ? tApp(locale, 'dashboard.incomplete') : '';
}
export function DashboardKpiCard({ label, value, exact, hint, tone }: { label: string; value: string; exact: string; hint: string; tone?: 'warning' | 'success' | 'destructive' }) {
  return <div className="min-w-0 break-words" title={`${label}: ${exact}`}><MetricCard label={label} value={value} hint={hint} tone={tone} /><span className="sr-only">{exact}</span></div>;
}
export function DashboardKpiGrid({ data, locale }: { data: DashboardData; locale: AppLocale }) {
  const { kpis, completeness } = data;
  const annualHint = sourceHint(completeness.annual, locale) || tApp(locale, 'dashboard.annualSource');
  const cashHint = data.cashMissingYear !== null && completeness.cash.state === 'ready'
    ? tApp(locale, 'dashboard.cashPrerequisite').replace('{year}', String(data.cashMissingYear))
    : sourceHint(completeness.cash, locale) || tApp(locale, 'dashboard.cashSource');
  const completeLiquidity = completeness.liquidity.state === 'ready' && completeness.liquidity.missing === 0;
  const liquidityHint = [kpis.liquidityMonth === null ? '' : monthName(locale, kpis.liquidityMonth), sourceHint(completeness.liquidity, locale),
    completeLiquidity && kpis.liquidityGap !== null && kpis.liquidityGap >= 0 ? tApp(locale, 'dashboard.above') : kpis.liquidityGap !== null && kpis.liquidityGap < 0 ? tApp(locale, 'dashboard.risk') : ''].filter(Boolean).join(' · ');
  return <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    {(['sales', 'costs', 'profit', 'margin'] as const).map(key => <DashboardKpiCard key={key} label={tApp(locale, `dashboard.${key}`)} value={key === 'margin' ? percent(locale, kpis[key]) : money(locale, kpis[key], true)} exact={key === 'margin' ? percent(locale, kpis[key]) : money(locale, kpis[key])} hint={annualHint} tone={completeness.annual.missing ? 'warning' : undefined} />)}
    <DashboardKpiCard label={tApp(locale, 'dashboard.cash')} value={money(locale, kpis.endingCash, true)} exact={money(locale, kpis.endingCash)} hint={cashHint} tone={completeness.cash.missing ? 'warning' : undefined} />
    <DashboardKpiCard label={tApp(locale, 'dashboard.gap')} value={money(locale, kpis.liquidityGap, true)} exact={money(locale, kpis.liquidityGap)} hint={liquidityHint} tone={kpis.liquidityGap !== null && kpis.liquidityGap < 0 ? 'destructive' : completeLiquidity ? 'success' : 'warning'} />
  </section>;
}
export function DashboardChartCard({ title, description, source, locale, children }: { title: string; description: string; source: Completeness; locale: AppLocale; children: ReactNode }) {
  return <Card className="min-w-0 space-y-4"><SectionHeader title={title} description={description} />
    {source.state !== 'ready' ? <p className="flex h-80 items-center justify-center text-center text-body-small text-text-secondary">{sourceHint(source, locale)}</p> : <>
      {source.missing > 0 ? <p className="text-body-small text-warning">{tApp(locale, 'dashboard.incomplete')} · {tApp(locale, 'dashboard.missing').replace('{missing}', String(source.missing)).replace('{expected}', String(source.expected))}</p> : null}
      {children}
    </>}
  </Card>;
}
export function ManagementDashboard({ data, locale }: { data: DashboardData; locale: AppLocale }) {
  return <>
    <DashboardKpiGrid data={data} locale={locale} />
    <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
      <DashboardChartCard title={tApp(locale, 'dashboard.profitability')} description={tApp(locale, 'dashboard.annualSource')} source={data.completeness.annual} locale={locale}><ProfitabilityChart data={data.profitabilityMonths} locale={locale} /></DashboardChartCard>
      <DashboardChartCard title={tApp(locale, 'dashboard.liquidity')} description={tApp(locale, 'dashboard.liquiditySource')} source={data.completeness.liquidity} locale={locale}><LiquidityOutlookChart data={data.liquidityMonths} locale={locale} /></DashboardChartCard>
      <DashboardChartCard title={tApp(locale, 'dashboard.customers')} description={tApp(locale, 'dashboard.salesSource')} source={data.completeness.sales} locale={locale}>
        <CustomerSalesDonut data={data.customerSales} total={data.salesTotal} renderable={data.donutRenderable} locale={locale} />
        {data.salesDifference !== null && Math.abs(data.salesDifference) >= 0.01 ? <p className="text-body-small text-warning">{tApp(locale, 'dashboard.difference').replace('{amount}', money(locale, data.salesDifference))}</p> : null}
      </DashboardChartCard>
      <DashboardChartCard title={tApp(locale, 'dashboard.monthlyCosts')} description={tApp(locale, 'dashboard.annualSource')} source={data.completeness.annual} locale={locale}><MonthlyCostsChart data={data.monthlyCosts} locale={locale} /></DashboardChartCard>
    </section>
  </>;
}
