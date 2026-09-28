import { EmptyState, SectionHeader, Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui';
import { tSales, tScenarioCode, salesMonthLabels } from '@/lib/i18n/sales-ui';
import type { AppLocale } from '@/lib/i18n/config';
import type { SalesReport } from '@/lib/sales/service';

export function SalesReportView({report,locale}:{report:SalesReport;locale:AppLocale}) {
  const number = new Intl.NumberFormat({fi:'fi-FI',pl:'pl-PL',en:'en-GB'}[locale], {maximumFractionDigits:2});
  // Always show the currency code from the aggregate; never assume EUR or convert.
  const money = (amount:number,currency:string) => `${number.format(amount)} ${currency}`;
  if (!report.totals.length) return <EmptyState title={tSales(locale,'sales.noData')} description={tSales(locale,'sales.empty')} />;
  return <div className="space-y-6">
    <SectionHeader title={tSales(locale,'sales.revenue')} />
    <Table><TableHeader><tr><th>{tSales(locale,'sales.scenario')}</th><th>{tSales(locale,'sales.revenue')}</th><th>{tSales(locale,'sales.volume')}</th></tr></TableHeader><TableBody>
      {report.totals.map(row => <TableRow key={`${row.scenario}:${row.currency_code}`}><TableCell>{tScenarioCode(locale,row.scenario)}</TableCell><TableCell>{money(row.revenue,row.currency_code)}</TableCell><TableCell>{number.format(row.volume)} m³</TableCell></TableRow>)}
    </TableBody></Table>
    <SectionHeader title={tSales(locale,'sales.monthlyTrend')} />
    <Table><TableHeader><tr><th>{tSales(locale,'sales.month')}</th><th>{tSales(locale,'sales.scenario')}</th><th>{tSales(locale,'sales.revenue')}</th></tr></TableHeader><TableBody>
      {report.months.map(row => <TableRow key={`${row.scenario}:${row.currency_code}:${row.month_number}`}><TableCell>{salesMonthLabels(locale)[row.month_number-1]}</TableCell><TableCell>{tScenarioCode(locale,row.scenario)}</TableCell><TableCell>{money(row.revenue,row.currency_code)}</TableCell></TableRow>)}
    </TableBody></Table>
    <SectionHeader title={tSales(locale,'sales.avgPrice')} />
    <Table><TableHeader><tr><th>{tSales(locale,'sales.scenario')}</th><th>{tSales(locale,'sales.pricingBasis')}</th><th>{tSales(locale,'sales.avgPrice')}</th></tr></TableHeader><TableBody>
      {report.prices.map(row => <TableRow key={`${row.scenario}:${row.currency_code}:${row.pricing_basis_code}`}><TableCell>{tScenarioCode(locale,row.scenario)}</TableCell><TableCell>{row.pricing_basis_code}</TableCell><TableCell>{row.price === null ? '—' : money(row.price,row.currency_code)}</TableCell></TableRow>)}
    </TableBody></Table>
    <SectionHeader title={tSales(locale,'sales.byCustomer')} />
    <Table><TableBody>{report.customers.map(row => <TableRow key={`${row.scenario}:${row.currency_code}:${row.customer_id}`}><TableCell>{row.customer_name}</TableCell><TableCell>{tScenarioCode(locale,row.scenario)}</TableCell><TableCell>{money(row.revenue,row.currency_code)}</TableCell></TableRow>)}</TableBody></Table>
    <SectionHeader title={tSales(locale,'sales.byProduct')} />
    <Table><TableBody>{report.products.map(row => <TableRow key={`${row.scenario}:${row.currency_code}:${row.product_id}`}><TableCell>{row.product_name}</TableCell><TableCell>{tScenarioCode(locale,row.scenario)}</TableCell><TableCell>{money(row.revenue,row.currency_code)}</TableCell></TableRow>)}</TableBody></Table>
  </div>;
}
