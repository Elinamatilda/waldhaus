import { validateYear } from './validation';
import type { SalesReport, ScenarioCode } from './service';
import { customerSalesLink, customerShare, rankedCustomerRevenue, sumSalesMoney } from './customer-share';

export const ANALYSIS_SCENARIOS = ['BUDGET', 'FORECAST', 'ACTUAL'] as const;
export type CustomerAnalysisFilters = { year: number; scenario: ScenarioCode; currency: 'EUR' };
export function customerAnalysisFilters(input: { year?: unknown; scenario?: unknown }, defaultYear: number): CustomerAnalysisFilters {
  const yearInput = input.year ?? defaultYear;
  if (typeof yearInput !== 'string' && typeof yearInput !== 'number') throw new Error('INVALID_YEAR');
  const year = validateYear(Number(yearInput));
  const scenario = input.scenario ?? 'BUDGET';
  if (!ANALYSIS_SCENARIOS.some(code => code === scenario)) throw new Error('INVALID_SCENARIO');
  return { year, scenario: scenario as ScenarioCode, currency: 'EUR' };
}
export function inCustomerAnalysisScope(row: { scenario: string; currency_code: string }, filters: CustomerAnalysisFilters) {
  return row.scenario === filters.scenario && row.currency_code === filters.currency;
}
export type CustomerMonthReport = { customerId: string; months: SalesReport['months'] };
export type CustomerAnalysisRow = { customerId: string; customerName: string; months: (number | null)[]; annualTotal: number; sharePercent: number | null; href: string };
const sumPresent = (values: readonly (number | null)[]) => values.every(value => value === null) ? null : sumSalesMoney(values.filter((value): value is number => value !== null));
const centsEqual = (a: number | null, b: number | null) => a === null || b === null ? a === b : Math.round(a * 100) === Math.round(b * 100);

/** All money and series derive from the same customer/month aggregates, never source labels. */
export function prepareCustomerAnalysis(report: SalesReport, details: CustomerMonthReport[], filters: CustomerAnalysisFilters) {
  const annual = report.customers.filter(row => inCustomerAnalysisScope(row, filters));
  const totalRows = report.totals.filter(row => inCustomerAnalysisScope(row, filters));
  const reportedTotal = totalRows.length ? sumSalesMoney(totalRows.map(row => row.revenue)) : null;
  const byCustomer = new Map(details.map(row => [row.customerId, row]));
  const customers: CustomerAnalysisRow[] = annual.map(row => {
    const detail = byCustomer.get(row.customer_id);
    if (!detail) throw new Error('CUSTOMER_MATRIX_INCOMPLETE');
    const scopedMonths = detail.months.filter(month => inCustomerAnalysisScope(month, filters));
    const months = Array.from({ length: 12 }, (_, i) => {
      const matches = scopedMonths.filter(month => month.month_number === i + 1);
      return matches.length ? sumSalesMoney(matches.map(month => month.revenue)) : null;
    });
    const annualTotal = sumPresent(months);
    if (annualTotal === null || !centsEqual(annualTotal, row.revenue)) throw new Error('CUSTOMER_REPORT_CHANGED');
    return { customerId: row.customer_id, customerName: row.customer_name, months, annualTotal,
      sharePercent: reportedTotal !== null && reportedTotal > 0 ? annualTotal / reportedTotal * 100 : null,
      href: customerSalesLink(filters.year, row.customer_id, filters.scenario) };
  }).sort((a, b) => b.annualTotal - a.annualTotal || a.customerId.localeCompare(b.customerId));
  const totalSales = customers.length ? sumSalesMoney(customers.map(row => row.annualTotal)) : null;
  if (!centsEqual(totalSales, reportedTotal)) throw new Error('CUSTOMER_REPORT_CHANGED');
  const monthTotals = Array.from({ length: 12 }, (_, i) => sumPresent(customers.map(row => row.months[i])));
  for (let i = 0; i < 12; i++) {
    const source = report.months.filter(row => inCustomerAnalysisScope(row, filters) && row.month_number === i + 1);
    if (!centsEqual(monthTotals[i], source.length ? sumSalesMoney(source.map(row => row.revenue)) : null)) throw new Error('CUSTOMER_REPORT_CHANGED');
  }
  const revenues = customers.map(row => ({ customerId: row.customerId, customerName: row.customerName, revenue: row.annualTotal }));
  const share = customerShare(revenues, filters.year, filters.scenario);
  // Monthly stacks always use the same top five ANNUAL identities, plus Others.
  const ranked = rankedCustomerRevenue(revenues);
  const series = ranked.slice(0, 5).map((row, i) => ({ key: `customer${i}`, customerId: row.customerId as string | null, name: row.customerName, href: customerSalesLink(filters.year, row.customerId, filters.scenario) }));
  if (ranked.length > 5) series.push({ key: 'others', customerId: null, name: '', href: customerSalesLink(filters.year, null, filters.scenario) });
  const topIds = new Set(series.filter(row => row.customerId !== null).map(row => row.customerId));
  const monthlySeries = monthTotals.map((total, i) => {
    const point: Record<string, number | null> & { month: number; total: number | null } = { month: i + 1, total };
    for (const item of series) point[item.key] = item.customerId === null
      ? sumPresent(customers.filter(row => !topIds.has(row.customerId)).map(row => row.months[i]))
      : customers.find(row => row.customerId === item.customerId)!.months[i];
    return point;
  });
  return { ...filters, totalSales, customerCount: customers.length, largestCustomer: customers[0] ?? null,
    largestCustomerShare: customers[0]?.sharePercent ?? null,
    top3Share: totalSales !== null && totalSales > 0 ? sumSalesMoney(customers.slice(0, 3).map(row => row.annualTotal)) / totalSales * 100 : null,
    averageMonthlySales: totalSales === null ? null : totalSales / 12,
    customers, monthTotals, share, series, monthlySeries,
    excludedCurrencies: [...new Set(report.totals.filter(row => row.scenario === filters.scenario && row.currency_code !== 'EUR').map(row => row.currency_code))].sort(),
  };
}
export type CustomerAnalysisData = ReturnType<typeof prepareCustomerAnalysis>;
export type CustomerAnalysisSort = 'total-desc' | 'total-asc' | 'name-asc' | 'name-desc' | 'share-desc' | 'share-asc';
export function customerTableRows(rows: CustomerAnalysisRow[], query: string, sort: CustomerAnalysisSort, locale: string) {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const matches = rows.filter(row => row.customerName.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)));
  return matches.sort((a, b) => {
    let result: number;
    if (sort.startsWith('name')) result = collator.compare(a.customerName, b.customerName);
    else if (sort.startsWith('share')) result = (a.sharePercent ?? -Infinity) - (b.sharePercent ?? -Infinity);
    else result = a.annualTotal - b.annualTotal;
    return (sort.endsWith('desc') ? -result : result) || collator.compare(a.customerName, b.customerName) || a.customerId.localeCompare(b.customerId);
  });
}

export function scopedCustomerReport(report: SalesReport, filters: CustomerAnalysisFilters): SalesReport {
  const match = (row: { scenario: string; currency_code: string }) => inCustomerAnalysisScope(row, filters);
  return { totals: report.totals.filter(match), months: report.months.filter(match), customers: report.customers.filter(match), products: report.products.filter(match), prices: report.prices.filter(match) };
}

export type CustomerProductAnalysisRow = { productId: string; productName: string; months: (number | null)[]; annualTotal: number; sharePercent: number | null; href: string };
/** Product IDs come directly from sales_facts.product_id, never inferred from labels or terms. */
export function prepareCustomerProducts(report: SalesReport, details: CustomerMonthReport[], filters: CustomerAnalysisFilters): CustomerProductAnalysisRow[] {
  const mapped = { ...report, customers: report.products.map(row => ({ ...row, customer_id: row.product_id, customer_name: row.product_name })) };
  return prepareCustomerAnalysis(mapped, details, filters).customers.map(row => ({ productId: row.customerId, productName: row.customerName, months: row.months, annualTotal: row.annualTotal, sharePercent: row.sharePercent,
    href: `/sales/products/${encodeURIComponent(row.customerId)}?year=${filters.year}&scenario=${filters.scenario}` }));
}
