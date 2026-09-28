'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipValueType, type TooltipContentProps } from 'recharts';
import { Card, Table, TableCell, TableHeader, TableRow } from '@/components/ui';
import type { DashboardData } from '@/lib/dashboard/model';
import type { AppLocale } from '@/lib/i18n/config';
import { tApp } from '@/lib/i18n/app-ui';
import { money, monthName, percent } from '@/lib/dashboard/format';

const linkClass = 'rounded-sm text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-focus-ring';
const grid = <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />;
function ChartTooltip({ active, payload, label, locale, liquidity = false }: TooltipContentProps<TooltipValueType, string | number> & { locale: AppLocale; liquidity?: boolean }) {
  if (!active || !payload?.length) return null;
  const gap: unknown = payload[0]?.payload?.gap;
  return <Card className="max-w-full text-body-small">
    <p className="font-semibold">{typeof label === 'number' ? monthName(locale, label) : label}</p>
    {payload.map(item => <p key={String(item.dataKey)}>{item.name}: {item.dataKey === 'margin' ? percent(locale, typeof item.value === 'number' ? item.value : null) : money(locale, typeof item.value === 'number' ? item.value : null)}</p>)}
    {liquidity && typeof gap === 'number' ? <p>{tApp(locale, 'dashboard.gap')}: {money(locale, gap)} {gap < 0 ? `(${tApp(locale, 'dashboard.risk')})` : ''}</p> : null}
  </Card>;
}
function MonthDetails({ rows, locale, columns }: { rows: Array<{ month: number; href: string; [key: string]: string | number | null }>; locale: AppLocale; columns: Array<{ key: string; label: string; percentage?: boolean }> }) {
  return <details className="mt-4 min-w-0 text-body-small">
    <summary className={`cursor-pointer ${linkClass}`}>{tApp(locale, 'dashboard.details')}</summary>
    <div className="overflow-x-auto"><Table className="mt-3"><TableHeader><tr><th scope="col" className="px-4 py-3">{tApp(locale, 'dashboard.month')}</th>{columns.map(column => <th scope="col" className="px-4 py-3" key={column.key}>{column.label}</th>)}</tr></TableHeader>
      <tbody>{rows.map(row => <TableRow key={row.month}><TableCell><Link className={linkClass} href={row.href}>{monthName(locale, row.month)}</Link></TableCell>{columns.map(column => <TableCell key={column.key}>{typeof row[column.key] === 'number' ? column.percentage ? percent(locale, row[column.key] as number) : money(locale, row[column.key] as number) : '—'}</TableCell>)}</TableRow>)}</tbody>
    </Table></div>
  </details>;
}
export function ProfitabilityChart({ data, locale }: { data: DashboardData['profitabilityMonths']; locale: AppLocale }) {
  const router = useRouter();
  return <><div className="h-80 min-w-0 w-full" role="group" aria-label={tApp(locale, 'dashboard.profitability')}><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <ComposedChart data={data} onClick={state => { const row = state.activeTooltipIndex == null ? undefined : data[Number(state.activeTooltipIndex)]; if (row) router.push(row.href); }}>
      {grid}<XAxis dataKey="month" tickFormatter={value => monthName(locale, value, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <YAxis yAxisId="eur" width={65} tickFormatter={value => money(locale, value, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <YAxis yAxisId="percent" orientation="right" width={50} tickFormatter={value => percent(locale, value)} tick={{ fill: 'var(--text-secondary)' }} />
      <Tooltip content={props => <ChartTooltip {...props} locale={locale} />} /><Legend />
      <Bar yAxisId="eur" dataKey="sales" name={tApp(locale, 'dashboard.sales')} fill="var(--chart-sales)" isAnimationActive={false} />
      <Bar yAxisId="eur" dataKey="costs" name={tApp(locale, 'dashboard.costs')} fill="var(--chart-costs)" isAnimationActive={false} />
      <Line yAxisId="percent" dataKey="margin" name={tApp(locale, 'dashboard.margin')} stroke="var(--chart-profit)" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer></div><MonthDetails rows={data} locale={locale} columns={[{ key: 'sales', label: tApp(locale, 'dashboard.sales') }, { key: 'costs', label: tApp(locale, 'dashboard.costs') }, { key: 'margin', label: tApp(locale, 'dashboard.margin'), percentage: true }]} /></>;
}
export function LiquidityOutlookChart({ data, locale }: { data: DashboardData['liquidityMonths']; locale: AppLocale }) {
  const router = useRouter();
  const risks = data.filter(row => row.gap !== null && row.gap < 0);
  return <><div className="h-80 min-w-0 w-full" role="group" aria-label={tApp(locale, 'dashboard.liquidity')}><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <LineChart data={data} onClick={state => { const row = state.activeTooltipIndex == null ? undefined : data[Number(state.activeTooltipIndex)]; if (row) router.push(row.href); }}>
      {grid}<XAxis dataKey="month" tickFormatter={value => monthName(locale, value, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <YAxis width={75} tickFormatter={value => money(locale, value, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <ReferenceLine y={0} stroke="var(--border-strong)" /><Tooltip content={props => <ChartTooltip {...props} locale={locale} liquidity />} /><Legend />
      <Line dataKey="closing" name={tApp(locale, 'dashboard.closing')} stroke="var(--chart-cash)" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
      <Line dataKey="minimum" name={tApp(locale, 'dashboard.minimum')} stroke="var(--chart-target)" strokeWidth={2} strokeDasharray="5 5" connectNulls={false} isAnimationActive={false} />
    </LineChart>
  </ResponsiveContainer></div>
    {risks.length ? <p className="mt-3 text-body-small text-destructive">{tApp(locale, 'dashboard.risk')}: {risks.map(row => monthName(locale, row.month)).join(', ')}</p> : null}
    <MonthDetails rows={data} locale={locale} columns={[{ key: 'closing', label: tApp(locale, 'dashboard.closing') }, { key: 'minimum', label: tApp(locale, 'dashboard.minimum') }, { key: 'gap', label: tApp(locale, 'dashboard.gap') }]} /></>;
}
export function MonthlyCostsChart({ data, locale }: { data: DashboardData['monthlyCosts']; locale: AppLocale }) {
  const router = useRouter();
  return <><div className="h-80 min-w-0 w-full" role="group" aria-label={tApp(locale, 'dashboard.monthlyCosts')}><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <BarChart data={data} onClick={state => { const row = state.activeTooltipIndex == null ? undefined : data[Number(state.activeTooltipIndex)]; if (row) router.push(row.href); }}>
      {grid}<XAxis dataKey="month" tickFormatter={value => monthName(locale, value, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <YAxis width={75} tickFormatter={value => money(locale, value, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <Tooltip content={props => <ChartTooltip {...props} locale={locale} />} /><Legend />
      <Bar dataKey="costs" name={tApp(locale, 'dashboard.costs')} fill="var(--chart-costs)" isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer></div><MonthDetails rows={data} locale={locale} columns={[{ key: 'costs', label: tApp(locale, 'dashboard.costs') }]} /></>;
}
export { CustomerSalesDonut } from '@/components/sales/customer-sales-share';
