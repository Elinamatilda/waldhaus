'use client';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { Card, FormField, SearchInput, SectionHeader, Select, Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui';
import { customerTableRows, type CustomerAnalysisData, type CustomerAnalysisSort, type CustomerProductAnalysisRow } from '@/lib/sales/customer-analysis';
import type { AppLocale } from '@/lib/i18n/config';
import { tApp, type AppMessageKey } from '@/lib/i18n/app-ui';
import { localeTag, money, monthName, percent } from '@/lib/dashboard/format';
const sorts: Array<[CustomerAnalysisSort, AppMessageKey]> = [['total-desc', 'customerAnalysis.totalDesc'], ['total-asc', 'customerAnalysis.totalAsc'], ['name-asc', 'customerAnalysis.nameAsc'], ['name-desc', 'customerAnalysis.nameDesc'], ['share-desc', 'customerAnalysis.shareDesc'], ['share-asc', 'customerAnalysis.shareAsc']];
export function CustomerAnalysisTable({ data, locale, initialSearch = '', expandedCustomerId = null, productRows = null }: { data: CustomerAnalysisData; locale: AppLocale; initialSearch?: string; expandedCustomerId?: string | null; productRows?: CustomerProductAnalysisRow[] | null }) {
  const [query, setQuery] = useState(initialSearch);
  const [sort, setSort] = useState<CustomerAnalysisSort>('total-desc');
  const rows = customerTableRows(data.customers, query, sort, localeTag(locale));
  return <Card className="min-w-0 space-y-4">
    <SectionHeader title={tApp(locale, 'customerAnalysis.matrix')} description={tApp(locale, 'customerAnalysis.tableOnly')} />
    <div className="flex flex-wrap items-end gap-3">
      <FormField label={tApp(locale, 'customerAnalysis.tableSearch')} htmlFor="customer-analysis-search"><SearchInput id="customer-analysis-search" value={query} onChange={event => setQuery(event.target.value)} /></FormField>
      <FormField label={tApp(locale, 'customerAnalysis.sort')} htmlFor="customer-analysis-sort"><Select id="customer-analysis-sort" value={sort} onChange={event => setSort(event.target.value as CustomerAnalysisSort)}>{sorts.map(([value, label]) => <option key={value} value={value}>{tApp(locale, label)}</option>)}</Select></FormField>
    </div>
    <p className="text-body-small text-text-secondary">{tApp(locale, 'customerAnalysis.missing')}</p>
    <div className="max-w-full overflow-x-auto rounded-md border border-border" tabIndex={0} role="region" aria-label={tApp(locale, 'customerAnalysis.matrix')}>
      <Table className="whitespace-nowrap text-body-small tabular-nums">
        <caption className="sr-only">{tApp(locale, 'customerAnalysis.matrix')} · {data.year} · EUR</caption>
        <TableHeader><tr><th scope="col" className="sticky left-0 z-10 bg-surface-subtle px-4 py-3 text-left">{tApp(locale, 'sales.customer')}</th>{Array.from({ length: 12 }, (_, i) => <th scope="col" key={i} className="px-4 py-3 text-right">{monthName(locale, i + 1)}</th>)}<th scope="col" className="px-4 py-3 text-right">{tApp(locale, 'customerAnalysis.annualTotal')}</th><th scope="col" className="px-4 py-3 text-right">{tApp(locale, 'customerAnalysis.share')}</th></tr></TableHeader>
        <TableBody>{rows.map(row => <Fragment key={row.customerId}><TableRow>
          <th scope="row" className="sticky left-0 bg-surface-raised px-4 py-3 text-left font-medium"><Link prefetch={false} scroll={false} className="mr-3 rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring" aria-expanded={expandedCustomerId === row.customerId} aria-label={`${tApp(locale, expandedCustomerId === row.customerId ? 'customerAnalysis.collapse' : 'customerAnalysis.expand')} ${row.customerName}`} href={`/sales/customers?year=${data.year}&scenario=${data.scenario}${expandedCustomerId === row.customerId ? '' : `&expand=${encodeURIComponent(row.customerId)}`}`}>{expandedCustomerId === row.customerId ? '−' : '+'}</Link><Link className="rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring" href={row.href}>{row.customerName}</Link></th>
          {row.months.map((value, i) => <TableCell key={i} className="text-right">{money(locale, value)}</TableCell>)}
          <TableCell className="text-right font-semibold">{money(locale, row.annualTotal)}</TableCell><TableCell className="text-right">{percent(locale, row.sharePercent)}</TableCell>
        </TableRow>
        {expandedCustomerId === row.customerId ? productRows === null ? <TableRow><TableCell colSpan={15}><p role="status">{tApp(locale, 'customerAnalysis.productError')}</p></TableCell></TableRow> : productRows.map(product => <TableRow key={product.productId} className="bg-surface">
          <th scope="row" className="sticky left-0 bg-surface px-4 py-3 pl-10 text-left font-normal"><Link className="rounded-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring" href={product.href}>{product.productName}</Link></th>
          {product.months.map((value, i) => <TableCell key={i} className="text-right">{money(locale, value)}</TableCell>)}
          <TableCell className="text-right">{money(locale, product.annualTotal)}</TableCell><TableCell className="text-right">—</TableCell>
        </TableRow>) : null}
        </Fragment>)}</TableBody>
      </Table>
    </div>
    {!rows.length ? <p role="status" className="text-body-small text-text-secondary">{tApp(locale, 'customerAnalysis.noResults')}</p> : null}
    <p className="text-body-small text-text-secondary">{tApp(locale, 'customerAnalysis.productDefinition')}</p>
  </Card>;
}
