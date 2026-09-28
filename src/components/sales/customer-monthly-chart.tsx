'use client';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui';
import type { CustomerAnalysisData } from '@/lib/sales/customer-analysis';
import type { AppLocale } from '@/lib/i18n/config';
import { tApp } from '@/lib/i18n/app-ui';
import { money, monthName } from '@/lib/dashboard/format';
export function CustomerMonthlyChart({ data, locale }: { data: Pick<CustomerAnalysisData, 'series' | 'monthlySeries'>; locale: AppLocale }) {
  const router = useRouter();
  return <div className="h-80 min-w-0 w-full" role="group" aria-label={tApp(locale, 'customerAnalysis.monthly')}><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <BarChart data={data.monthlySeries} stackOffset="sign">
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis dataKey="month" tickFormatter={month => monthName(locale, month, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <YAxis width={75} tickFormatter={value => money(locale, value, true)} tick={{ fill: 'var(--text-secondary)' }} />
      <Legend />
      <Tooltip content={({ active, payload, label }) => active && payload?.length ? <Card className="text-body-small"><p className="font-semibold">{monthName(locale, Number(label))}</p>{payload.map(item => <p key={String(item.dataKey)}>{item.name}: {money(locale, typeof item.value === 'number' ? item.value : null)}</p>)}</Card> : null} />
      {data.series.map((series, index) => <Bar key={series.key} stackId="customers" dataKey={series.key} name={series.customerId === null ? tApp(locale, 'dashboard.others') : series.name} fill={`var(--chart-customer-${index + 1})`} isAnimationActive={false} onClick={() => router.push(series.href)} />)}
    </BarChart>
  </ResponsiveContainer></div>;
}
