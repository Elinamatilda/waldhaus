'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui';
import type { CustomerShareSlice } from '@/lib/sales/customer-share';
import type { AppLocale } from '@/lib/i18n/config';
import { tApp } from '@/lib/i18n/app-ui';
import { money } from '@/lib/dashboard/format';
const linkClass = 'rounded-sm text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-focus-ring';

export function CustomerSalesDonut({ data, total, renderable, locale, title, totalLabel }: { data: CustomerShareSlice[]; total: number | null; renderable: boolean; locale: AppLocale; title?: string; totalLabel?: string }) {
  const router = useRouter();
  const customers = data.map(row => ({ ...row, name: row.id === null ? tApp(locale, 'dashboard.others') : row.name }));
  return <>
    <div className="relative h-80 min-w-0 w-full" role="group" aria-label={title ?? tApp(locale, 'dashboard.customers')}>
      {renderable ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart>
        <Pie data={customers} dataKey="revenue" nameKey="name" innerRadius="65%" outerRadius="90%" isAnimationActive={false} onClick={(_, index) => { const row = customers[index]; if (row) router.push(row.href); }}>
          {customers.map((row, index) => <Cell key={row.id ?? 'others'} fill={`var(--chart-customer-${index + 1})`} stroke="var(--surface-raised)" />)}
        </Pie><Tooltip content={({ active, payload }) => active && payload?.length ? <Card className="text-body-small"><p>{payload[0].name}</p><p>{money(locale, typeof payload[0].value === 'number' ? payload[0].value : null)}</p></Card> : null} />
      </PieChart></ResponsiveContainer> : null}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center"><p className="text-section-title font-semibold" title={money(locale, total)}>{money(locale, total, true)}</p><p className="max-w-40 text-body-small text-text-secondary">{totalLabel ?? tApp(locale, 'dashboard.sales')}</p></div>
    </div>
    {!renderable ? <p className="text-body-small text-text-secondary">{tApp(locale, 'dashboard.donutUnavailable')}</p> : null}
    <ul className="mt-3 space-y-2 text-body-small">{customers.map((row, index) => <li className="flex min-w-0 items-start gap-2" key={row.id ?? 'others'}><span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: `var(--chart-customer-${index + 1})` }} /><Link href={row.href} className={`min-w-0 break-words ${linkClass}`}>{row.name}</Link><span className="ml-auto shrink-0 tabular-nums">{money(locale, row.revenue)}</span></li>)}</ul>
  </>;
}
