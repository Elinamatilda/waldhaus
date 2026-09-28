import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadModule } from '../auth/load-module.mjs';
const { prepareCustomerAnalysis, customerAnalysisFilters, customerTableRows, scopedCustomerReport, prepareCustomerProducts } = loadModule('src/lib/sales/customer-analysis.ts');
const { customerShare, customerSalesLink } = loadModule('src/lib/sales/customer-share.ts');
const filters = { year: 2026, scenario: 'BUDGET', currency: 'EUR' };
const sum = values => values.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
const base = { organization: 'org-A', year: 2026, scenario: 'BUDGET', currency_code: 'EUR' };
const facts = [
  { ...base, customer_id: 'pihla', customer_name: 'Pihla Group Oy', product_id: 'oak', product_name: 'OAK', source_label_raw: 'Pihla OAK', month_number: 1, revenue: 100 },
  { ...base, customer_id: 'pihla', customer_name: 'Pihla Group Oy', product_id: 'birch', product_name: 'Birch', source_label_raw: 'Pihla Birch', month_number: 1, revenue: 200 },
  { ...base, customer_id: 'pihla', customer_name: 'Pihla Group Oy', product_id: 'oak', product_name: 'OAK', month_number: 2, revenue: 0 },
  { ...base, customer_id: 'pihla', customer_name: 'Pihla Group Oy', product_id: 'oak', product_name: 'OAK', month_number: 12, revenue: 50 },
  { ...base, customer_id: 'second', customer_name: 'Second Customer', month_number: 1, revenue: 25 },
  { ...base, customer_id: 'second', customer_name: 'Second Customer', month_number: 2, revenue: 75 },
  { ...base, customer_id: 'zero', customer_name: 'Explicit Zero', month_number: 3, revenue: 0 },
  { ...base, customer_id: 'excluded', customer_name: 'PLN Customer', currency_code: 'PLN', month_number: 1, revenue: 1e6 },
  { ...base, customer_id: 'forecast', customer_name: 'Forecast Customer', scenario: 'FORECAST', month_number: 1, revenue: 900 },
  { ...base, customer_id: 'actual', customer_name: 'Actual Customer', scenario: 'ACTUAL', month_number: 1, revenue: 700 },
  { ...base, customer_id: 'other-org', customer_name: 'Other Org', organization: 'org-B', month_number: 1, revenue: 1e9 },
  { ...base, customer_id: 'other-year', customer_name: 'Other Year', year: 2025, month_number: 1, revenue: 1e9 },
];
function reportFor(source = facts, organization = 'org-A', year = 2026, customerId = null, productId = null) {
  const matching = source.filter(row => row.organization === organization && row.year === year && (customerId === null || row.customer_id === customerId) && (productId === null || (row.product_id ?? 'common') === productId)).map(row => ({ ...row, product_id: row.product_id ?? 'common', product_name: row.product_name ?? 'Product' }));
  function aggregate(keys) {
    const groups = new Map();
    for (const fact of matching) {
      const id = JSON.stringify(keys.map(key => fact[key]));
      if (!groups.has(id)) groups.set(id, { ...Object.fromEntries(keys.map(key => [key, fact[key]])), amounts: [] });
      groups.get(id).amounts.push(fact.revenue);
    }
    return [...groups.values()].map(({ amounts, ...row }) => ({ ...row, revenue: sum(amounts) }));
  }
  return { totals: aggregate(['scenario', 'currency_code']).map(row => ({ ...row, volume: 0 })), customers: aggregate(['scenario', 'currency_code', 'customer_id', 'customer_name']), months: aggregate(['scenario', 'currency_code', 'month_number']), products: aggregate(['scenario', 'currency_code', 'product_id', 'product_name']), prices: [] };
}
function dataFor(source = facts, selection = filters) {
  const report = reportFor(source, 'org-A', selection.year);
  const details = [...new Set(report.customers.map(row => row.customer_id))].map(customerId => ({ customerId, months: reportFor(source, 'org-A', selection.year, customerId).months }));
  return prepareCustomerAnalysis(report, details, selection);
}
test('customer annual totals aggregate canonical customer_id across products and raw labels', () => {
  const data = dataFor(); assert.equal(data.customers[0].customerName, 'Pihla Group Oy'); assert.equal(data.customers[0].annualTotal, 350);
  assert.equal(data.customers.filter(row => row.customerId === 'pihla').length, 1); assert.ok(data.customers.every(row => !['Pihla OAK', 'Pihla Birch'].includes(row.customerName)));
});
test('twelve monthly totals and sum of all customers match selected Sales total', () => {
  const data = dataFor(); assert.equal(data.monthTotals.length, 12); assert.deepEqual(data.monthTotals, [325, 75, 0, null, null, null, null, null, null, null, null, 50]);
  assert.equal(data.totalSales, 450); assert.equal(sum(data.customers.map(row => row.annualTotal)), data.totalSales); assert.equal(sum(data.monthTotals.map(value => value ?? 0)), data.totalSales);
});
test('largest, share, Top 3 and average monthly sales use the same annual total', () => {
  const data = dataFor(); assert.equal(data.largestCustomer.customerId, 'pihla'); assert.equal(data.largestCustomerShare, 350 / 450 * 100); assert.equal(data.top3Share, 100); assert.equal(data.averageMonthlySales, 37.5);
});
test('customers with facts are counted, including explicit zero, not master-only customers', () => { assert.equal(dataFor().customerCount, 3); });
test('missing month stays null; explicit zero stays zero', () => {
  const row = dataFor().customers.find(row => row.customerId === 'pihla'); assert.equal(row.months[1], 0); assert.equal(row.months[2], null);
});
test('scenario separation supports BUDGET, FORECAST, ACTUAL', () => {
  assert.equal(dataFor().totalSales, 450); assert.equal(dataFor(facts, { ...filters, scenario: 'FORECAST' }).totalSales, 900); assert.equal(dataFor(facts, { ...filters, scenario: 'ACTUAL' }).totalSales, 700);
});
test('EUR never includes other currencies and exclusions are explicit', () => { const data = dataFor(); assert.equal(data.totalSales, 450); assert.deepEqual(data.excludedCurrencies, ['PLN']); assert.ok(data.customers.every(row => row.customerId !== 'excluded')); });
test('no facts is unavailable, not a zero annual total', () => { const data = dataFor([]); assert.equal(data.totalSales, null); assert.equal(data.customerCount, 0); assert.equal(data.averageMonthlySales, null); assert.equal(data.share.renderable, false); });
test('zero-only facts retain total zero with safe unavailable percentages', () => { const data = dataFor(facts.filter(row => row.customer_id === 'zero')); assert.equal(data.totalSales, 0); assert.equal(data.customerCount, 1); assert.equal(data.largestCustomerShare, null); assert.equal(data.top3Share, null); });
test('negative revenue is retained; donut does not misrepresent signed values', () => { const data = dataFor([{ ...facts[0], revenue: -20 }]); assert.equal(data.totalSales, -20); assert.equal(data.share.renderable, false); assert.equal(data.largestCustomerShare, null); });
function manyCustomers(count) { return Array.from({ length: count }, (_, i) => ({ ...base, customer_id: `customer-${i}`, customer_name: `Customer ${i}`, month_number: 1, revenue: (count - i) * 10.01 })); }
test('Top 5 + Others exactly preserves every cent', () => {
  const data = dataFor(manyCustomers(8)); assert.equal(data.share.slices.length, 6); assert.equal(data.share.slices[5].revenue, 60.06); assert.equal(sum(data.share.slices.map(row => row.revenue)), data.totalSales);
});
test('six or fewer customers remain distinct in donut; monthly chart always caps top five', () => {
  for (const count of [1, 5, 6]) { const data = dataFor(manyCustomers(count)); assert.equal(data.share.slices.length, count); assert.ok(data.share.slices.every(row => row.id !== null)); if (count === 6) assert.equal(data.series[5].customerId, null); }
});
test('monthly Others uses fixed annual top five, preserves missing and zero', () => {
  const source = manyCustomers(8); source.push({ ...source[7], month_number: 2, revenue: 0 });
  const data = dataFor(source); assert.equal(data.monthlySeries[0].others, 60.06); assert.equal(data.monthlySeries[1].others, 0); assert.equal(data.monthlySeries[2].others, null);
  assert.equal(data.series.length, 6); for (const point of data.monthlySeries) { const values = data.series.map(series => point[series.key]); assert.equal(values.every(value => value === null) ? null : sum(values.map(value => value ?? 0)), point.total); }
});
test('year/scenario propagation for customer and Others links', () => {
  assert.equal(customerSalesLink(2027, 'a/b', 'FORECAST'), '/sales/customers/a%2Fb?year=2027&scenario=FORECAST');
  const data = dataFor(manyCustomers(8)); assert.equal(data.share.slices[5].href, '/sales/customers?year=2026&scenario=BUDGET'); assert.equal(data.customers[0].href, '/sales/customers/customer-0?year=2026&scenario=BUDGET');
});
test('dashboard and customer view share exactly one grouping algorithm', () => {
  const { prepareDashboard } = loadModule('src/lib/dashboard/model.ts');
  const report = reportFor(manyCustomers(8)); const absent = { state: 'empty', value: null };
  const dashboard = prepareDashboard(2026, { annual: absent, cash: absent, liquidity: absent, sales: { state: 'ready', value: report } });
  const analysis = dataFor(manyCustomers(8)); assert.deepEqual(dashboard.customerSales.map(row => ({ id: row.id, name: row.name, revenue: row.revenue })), analysis.share.slices.map(row => ({ id: row.id, name: row.name, revenue: row.revenue })));
  assert.deepEqual(customerShare([], 2026).slices, []);
});
test('table search/sorting never mutate management totals or ranking', () => {
  const data = dataFor(); const before = JSON.stringify(data);
  assert.equal(customerTableRows(data.customers, 'pihla', 'name-asc', 'fi-FI').length, 1);
  assert.equal(customerTableRows(data.customers, '', 'total-asc', 'en-GB')[0].customerId, 'zero');
  assert.equal(customerTableRows(data.customers, '', 'share-desc', 'en-GB')[0].customerId, 'pihla');
  assert.equal(customerTableRows(data.customers, '', 'name-asc', 'en-GB')[0].customerId, 'zero'); assert.equal(JSON.stringify(data), before);
});
test('filters default to current year/BUDGET and reject invalid or duplicate parameters', () => {
  assert.deepEqual(customerAnalysisFilters({}, 2026), filters);
  for (const input of [{ year: ['2026'] }, { year: 2019 }, { year: 2101 }, { year: 'bad' }, { scenario: ['ACTUAL'] }, { scenario: 'ALL' }]) assert.throws(() => customerAnalysisFilters(input, 2026));
});
test('customer details honor scenario/EUR across every report array', () => {
  const report = reportFor(); const scoped = scopedCustomerReport(report, { ...filters, scenario: 'ACTUAL' });
  for (const rows of Object.values(scoped)) assert.ok(rows.every(row => row.scenario === 'ACTUAL' && row.currency_code === 'EUR'));
});
test('concurrent changes or a missing monthly response cannot create inconsistent KPI/table totals', () => {
  const report = reportFor(); assert.throws(() => prepareCustomerAnalysis(report, [], filters), /INCOMPLETE/);
  const details = report.customers.map(row => ({ customerId: row.customer_id, months: reportFor(facts, 'org-A', 2026, row.customer_id).months }));
  report.customers[0].revenue += 1; assert.throws(() => prepareCustomerAnalysis(report, details, filters), /CHANGED/);
});
test('supplied 2026 monthly validation example sums to 725794.35 EUR', () => {
  const monthly = [19871.29, 7885, 26897.60, 100440.05, 97393.20, 82698, 13196.50, 87421, 130087.96, 66460.75, 21443, 72000];
  const source = monthly.map((revenue, i) => ({ ...base, customer_id: 'example', customer_name: 'Validation only', month_number: i + 1, revenue }));
  const data = dataFor(source); assert.deepEqual(data.monthTotals, monthly); assert.equal(data.totalSales, 725794.35); assert.equal(data.averageMonthlySales, 725794.35 / 12);
});
test('supplied customer-share examples round to the expected percentages', () => {
  const amounts = [217642.87, 193517.29, 101759.62, 212874.57];
  const source = amounts.map((revenue, i) => ({ ...base, customer_id: `id-${i}`, customer_name: i === 1 ? 'Pihla Group Oy' : `Example ${i}`, source_label_raw: i === 1 ? 'Pihla OAK' : '', month_number: 1, revenue }));
  const data = dataFor(source); assert.equal(data.totalSales, 725794.35);
  assert.equal(data.customers.find(row => row.customerId === 'id-0').sharePercent.toFixed(1), '30.0'); assert.equal(data.customers.find(row => row.customerId === 'id-1').sharePercent.toFixed(1), '26.7'); assert.equal(data.customers.find(row => row.customerId === 'id-2').sharePercent.toFixed(1), '14.0');
});
function harness({ organizationId = 'org-A', source = facts, forbidden = false, failedReport = false, failedMaster = false, failedProduct = false } = {}) {
  const calls = []; let active = 0; let maximum = 0;
  const master = [{ id: 'master-only', name: 'Master without facts' }];
  const service = loadModule('src/lib/sales/customer-analysis-service.ts', {
    '@/lib/auth/session': { requireRole: async role => { assert.equal(role, 'admin'); if (forbidden) throw new Error('FORBIDDEN'); } },
    './scope': { resolveSalesScope: async () => ({ organizationId, isSystemAdmin: true, organizations: [] }) },
    './service': { listCustomers: async org => { assert.equal(org, organizationId); if (failedMaster) throw new Error('offline'); return master; }, getSalesReport: async (org, year, customer = null, product = null) => {
      calls.push({ org, year, customer, product }); active++; maximum = Math.max(maximum, active); await new Promise(resolve => setImmediate(resolve)); active--;
      if (failedReport || (failedProduct && product !== null)) throw new Error('offline'); return reportFor(source, org, year, customer, product);
    } },
  });
  return { ...service, calls, maximum: () => maximum };
}
test('service scopes every RPC to authenticated organization and selected year', async () => {
  const h = harness(); const result = await h.loadCustomerAnalysis({ year: '2026', scenario: 'BUDGET' }, 2026);
  assert.equal(result.data.totalSales, 450); assert.equal(result.data.customerCount, 3); assert.equal(result.customers[0].id, 'master-only');
  assert.equal(h.calls.length, 4); assert.ok(h.calls.every(call => call.org === 'org-A' && call.year === 2026));
});
test('no selected organization or invalid filters perform no report reads', async () => {
  const noOrg = harness({ organizationId: null }); assert.equal((await noOrg.loadCustomerAnalysis({}, 2026)).kind, 'no-organization'); assert.equal(noOrg.calls.length, 0);
  const invalid = harness(); assert.equal((await invalid.loadCustomerAnalysis({ scenario: 'ALL' }, 2026)).kind, 'invalid'); assert.equal(invalid.calls.length, 0);
});
test('authorization failures propagate before any report request', async () => { const h = harness({ forbidden: true }); await assert.rejects(h.loadCustomerAnalysis({}, 2026), /FORBIDDEN/); assert.equal(h.calls.length, 0); });
test('no raw facts are fetched, concurrency is bounded and all customers are included', async () => {
  const h = harness({ source: manyCustomers(11) }); const result = await h.loadCustomerAnalysis({}, 2026); assert.equal(result.data.customers.length, 11); assert.equal(h.calls.length, 12); assert.equal(h.maximum(), 4);
});
test('one scoped customer needs only the initial report, and other currencies do not trigger detail reads', async () => {
  const h = harness({ source: [facts[0], facts[7]] }); const result = await h.loadCustomerAnalysis({}, 2026); assert.equal(h.calls.length, 1); assert.equal(result.data.totalSales, 100);
});
test('report failure preserves CRUD, master failure preserves analysis', async () => {
  const first = await harness({ failedReport: true }).loadCustomerAnalysis({}, 2026); assert.equal(first.data, null); assert.equal(first.customers.length, 1);
  const second = await harness({ failedMaster: true }).loadCustomerAnalysis({}, 2026); assert.equal(second.data.totalSales, 450); assert.equal(second.customers, null);
});
test('different selected year cannot reuse another year data', async () => { const result = await harness().loadCustomerAnalysis({ year: 2025 }, 2026); assert.equal(result.data.totalSales, 1e9); assert.equal(result.data.customers.length, 1); assert.equal(result.data.customers[0].customerId, 'other-year'); });
test('actual components SSR in FI/PL/EN: all month cells, missing/zero, links, responsive containers', () => {
  const ui = loadModule('src/components/ui/core.tsx', { react: React });
  const mocks = { react: React, '@/components/ui': ui, 'next/link': ({ children, ...props }) => { delete props.scroll; delete props.prefetch; return createElement('a', props, children); }, 'next/navigation': { useRouter: () => ({ push() {} }) } };
  const { CustomerAnalysisView } = loadModule('src/components/sales/customer-analysis-view.tsx', mocks);
  const { tApp } = loadModule('src/lib/i18n/app-ui.ts');
  for (const locale of ['fi', 'pl', 'en']) {
    const html = renderToStaticMarkup(createElement(CustomerAnalysisView, { locale, data: dataFor() }));
    assert.match(html, /Pihla Group Oy/); assert.doesNotMatch(html, /Pihla OAK|Pihla Birch|NaN|Infinity|undefined/);
    assert.match(html, /year=2026&amp;scenario=BUDGET/); assert.match(html, /overflow-x-auto/); assert.match(html, /grid-cols-1/); assert.match(html, /xl:grid-cols-2/); assert.ok(html.includes(tApp(locale, 'customerAnalysis.totalSales'))); assert.match(html, /—/);
    const empty = renderToStaticMarkup(createElement(CustomerAnalysisView, { locale, data: dataFor([]) })); assert.ok(empty.includes(tApp(locale, 'customerAnalysis.empty')));
    const productReport = reportFor(facts, 'org-A', 2026, 'pihla');
    const productDetails = productReport.products.map(row => ({ customerId: row.product_id, months: reportFor(facts, 'org-A', 2026, 'pihla', row.product_id).months }));
    const expanded = renderToStaticMarkup(createElement(CustomerAnalysisView, { locale, data: dataFor(), expandedCustomerId: 'pihla', productRows: prepareCustomerProducts(productReport, productDetails, filters) }));
    assert.match(expanded, /aria-expanded="true"/); assert.match(expanded, /sales\/products\/oak\?year=2026&amp;scenario=BUDGET/);
    const failed = renderToStaticMarkup(createElement(CustomerAnalysisView, { locale, data: dataFor(), expandedCustomerId: 'pihla', productRows: null }));
    assert.match(failed, /colSpan="15"|colspan="15"/); assert.ok(failed.includes(tApp(locale, 'customerAnalysis.productError')));

  }
});

test('product expansion uses canonical product IDs and preserves monthly missing/zero', () => {
  const report = reportFor(facts, 'org-A', 2026, 'pihla');
  const details = report.products.map(row => ({ customerId: row.product_id, months: reportFor(facts, 'org-A', 2026, 'pihla', row.product_id).months }));
  const rows = prepareCustomerProducts(report, details, filters);
  assert.equal(rows.length, 2); assert.equal(sum(rows.map(row => row.annualTotal)), 350);
  const oak = rows.find(row => row.productId === 'oak'); assert.equal(oak.productName, 'OAK'); assert.equal(oak.months[1], 0); assert.equal(oak.months[2], null); assert.equal(oak.href, '/sales/products/oak?year=2026&scenario=BUDGET');
});
test('only an explicitly expanded authorized customer loads product-month reports', async () => {
  const h = harness(); const result = await h.loadCustomerAnalysis({ expand: 'pihla' }, 2026);
  assert.equal(result.expandedCustomerId, 'pihla'); assert.equal(result.productRows.length, 2); assert.equal(sum(result.productRows.map(row => row.annualTotal)), 350);
  const reads = h.calls.filter(call => call.product !== null); assert.equal(reads.length, 2); assert.ok(reads.every(call => call.customer === 'pihla' && call.org === 'org-A' && call.year === 2026));
  const other = harness(); const denied = await other.loadCustomerAnalysis({ expand: 'other-org' }, 2026); assert.equal(denied.expandedCustomerId, null); assert.equal(other.calls.length, 4);
});

test('product breakdown failures leave customer analysis and CRUD available', async () => {
  const result = await harness({ failedProduct: true }).loadCustomerAnalysis({ expand: 'pihla' }, 2026);
  assert.equal(result.data.totalSales, 450); assert.equal(result.expandedCustomerId, 'pihla'); assert.equal(result.productRows, null); assert.equal(result.customers.length, 1);
});
