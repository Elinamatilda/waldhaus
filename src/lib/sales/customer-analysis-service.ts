import 'server-only';
import { requireRole } from '@/lib/auth/session';
import { resolveSalesScope } from './scope';
import { getSalesReport, listCustomers } from './service';
import { customerAnalysisFilters, inCustomerAnalysisScope, prepareCustomerAnalysis, prepareCustomerProducts, type CustomerProductAnalysisRow, type CustomerAnalysisFilters } from './customer-analysis';

/** Bound fan-out: existing RPC aggregates in PostgreSQL; raw facts never leave it. */
async function mapReports<T, R>(items: T[], read: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) { const index = next++; output[index] = await read(items[index]); }
  }));
  return output;
}
export async function readCustomerAnalysis(organizationId: string, filters: CustomerAnalysisFilters, readReport = getSalesReport) {
  const report = await readReport(organizationId, filters.year);
  const ids = [...new Set(report.customers.filter(row => inCustomerAnalysisScope(row, filters)).map(row => row.customer_id))];
  const details = await mapReports(ids, async customerId => {
    // With one customer in this exact scope the initial monthly report is sufficient.
    const detail = ids.length === 1 ? report : await readReport(organizationId, filters.year, customerId);
    return { customerId, months: detail.months };
  });
  return prepareCustomerAnalysis(report, details, filters);
}
export async function loadCustomerAnalysis(input: { year?: unknown; scenario?: unknown; expand?: unknown }, defaultYear: number) {
  await requireRole('admin');
  const scope = await resolveSalesScope();
  let filters: CustomerAnalysisFilters;
  try { filters = customerAnalysisFilters(input, defaultYear); } catch { return { kind: 'invalid' as const, scope }; }
  if (!scope.organizationId) return { kind: 'no-organization' as const, scope, filters };
  // A request-local cache lets expansion reuse customer aggregates already loaded above.
  const reports = new Map<string, ReturnType<typeof getSalesReport>>();
  const readReport: typeof getSalesReport = (organization, year, customer = null, product = null) => {
    const key = JSON.stringify([organization, year, customer, product]);
    if (!reports.has(key)) reports.set(key, getSalesReport(organization, year, customer, product));
    return reports.get(key)!;
  };
  const [analysis, customers] = await Promise.allSettled([
    readCustomerAnalysis(scope.organizationId, filters, readReport),
    listCustomers(scope.organizationId),
  ]);
  let expandedCustomerId: string | null = null;
  let productRows: CustomerProductAnalysisRow[] | null = null;
  if (analysis.status === 'fulfilled' && typeof input.expand === 'string') {
    const parent = analysis.value.customers.find(row => row.customerId === input.expand);
    // Validate against the authorized current report before querying a detail ID.
    if (parent) {
      expandedCustomerId = parent.customerId;
      try {
        const report = await readReport(scope.organizationId, filters.year, parent.customerId);
        const products = report.products.filter(row => inCustomerAnalysisScope(row, filters));
        const details = await mapReports(products, async product => ({ customerId: product.product_id,
          months: products.length === 1 ? report.months : (await readReport(scope.organizationId!, filters.year, parent.customerId, product.product_id)).months }));
        productRows = prepareCustomerProducts(report, details, filters);
        const totals = prepareCustomerAnalysis(report, [{ customerId: parent.customerId, months: report.months }], filters);
        if (totals.totalSales !== parent.annualTotal || totals.monthTotals.some((amount, i) => amount !== parent.months[i])) productRows = null;
      } catch { productRows = null; }
    }
  }
  return { kind: 'ready' as const, scope, filters, expandedCustomerId, productRows,
    data: analysis.status === 'fulfilled' ? analysis.value : null,
    error: analysis.status === 'rejected' && analysis.reason instanceof Error && analysis.reason.message === 'CUSTOMER_REPORT_CHANGED' ? 'changed' as const : 'unavailable' as const,
    customers: customers.status === 'fulfilled' ? customers.value : null };
}
