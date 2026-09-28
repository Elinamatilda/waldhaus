import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from '../auth/load-module.mjs';
const { prepareDashboard, monthLink, customerLink } = loadModule('src/lib/dashboard/model.ts');
const { BUDGET_INPUTS } = loadModule('src/lib/budget/model.ts');
const { resolveCashFlowOpening } = loadModule('src/lib/budget/cash-flow-model.ts');
const ready = value => ({ state: 'ready', value });
const months = fn => Array.from({ length: 12 }, (_, i) => ({ id: String(i), edit_version: '1', month_number: i + 1, ...fn(i) }));
const annual = () => months(() => ({ ...Object.fromEntries(BUDGET_INPUTS.map(key => [key, 10])), sales_amount: 100, production_m3: 1 }));
const cash = () => months(() => ({ opening_balance: 99999, sales_revenue: 100, other_income: 20, operating_costs: 30, investments: 10, loan_payments: 5 }));
const liquidity = () => months(() => ({ opening_balance: 100, forecasted_sales: 50, other_forecasted_income: 20, total_outflows: 100 }));
const sales = (n = 8) => ({ customers: Array.from({ length: n }, (_, i) => ({ scenario: 'BUDGET', currency_code: 'EUR', customer_id: `c${i}`, customer_name: `Customer ${i}`, revenue: (n - i) * 10.01 })), totals: [{ scenario: 'BUDGET', currency_code: 'EUR', revenue: n * (n + 1) / 2 * 10.01, volume: 0 }], months: [], products: [], prices: [] });
const sources = () => ({ annual: ready(annual()), cash: ready({ rows: cash(), openingBalance: 1000, missingYear: null }), liquidity: ready(liquidity()), sales: ready(sales()) });
const dashboard = () => prepareDashboard(2026, sources());
test('annual sales sums selected months', () => assert.equal(dashboard().kpis.sales, 1200));
test('annual costs include all seven categories', () => assert.equal(dashboard().kpis.costs, 840));
test('profit is annual sales minus costs', () => assert.equal(dashboard().kpis.profit, 360));
test('margin is weighted annual profit / sales, not average of months', () => {
  const input = sources(); input.annual.value[0].sales_amount = 1000;
  assert.equal(prepareDashboard(2026, input).kpis.margin, 60);
});
test('zero sales produces unavailable percentage, explicit zero sales remains zero', () => {
  const input = sources(); input.annual.value.forEach(row => row.sales_amount = 0);
  const data = prepareDashboard(2026, input); assert.equal(data.kpis.sales, 0); assert.equal(data.kpis.margin, null);
});
test('cash chains all twelve months and ignores saved monthly opening snapshots', () => assert.equal(dashboard().kpis.endingCash, 1900));
test('cash inherits December closing from 2025 seed', () => {
  const history = cash().map(row => ({ ...row, year_number: 2025, opening_balance: row.month_number === 1 ? 1000 : 99999 }));
  const input = sources(); input.cash.value = { rows: cash(), ...resolveCashFlowOpening(2026, history) };
  assert.equal(prepareDashboard(2026, input).kpis.endingCash, 2800);
});
test('missing cash opening cannot become a zero balance', () => {
  const input = sources(); input.cash.value.openingBalance = null; input.cash.value.missingYear = 2025;
  const data = prepareDashboard(2026, input); assert.equal(data.kpis.endingCash, null); assert.equal(data.cashMissingYear, 2025);
});
test('liquidity uses independent monthly openings and canonical 30% target', () => {
  const data = dashboard(); assert.equal(data.liquidityMonths[0].closing, 70); assert.equal(data.liquidityMonths[1].closing, 70); assert.equal(data.liquidityMonths[0].minimum, 30); assert.equal(data.kpis.liquidityGap, 40);
});
test('worst liquidity gap retains amount and month', () => {
  const input = sources(); input.liquidity.value[6].opening_balance = -100;
  const data = prepareDashboard(2026, input); assert.equal(data.kpis.liquidityGap, -160); assert.equal(data.kpis.liquidityMonth, 7);
});
test('BUDGET does not include ACTUAL or FORECAST', () => {
  const input = sources(); for (const scenario of ['ACTUAL', 'FORECAST']) { input.sales.value.customers.push({ ...input.sales.value.customers[0], scenario, revenue: 1e9 }); input.sales.value.totals.push({ scenario, currency_code: 'EUR', revenue: 1e9 }); }
  assert.equal(prepareDashboard(2026, input).salesTotal, 360.36); assert.equal(prepareDashboard(2026, input).customerSales[0].revenue, 80.08);
});
test('currencies never mix', () => {
  const input = sources(); input.sales.value.customers.push({ ...input.sales.value.customers[0], currency_code: 'PLN', revenue: 1e9 }); input.sales.value.totals.push({ scenario: 'BUDGET', currency_code: 'PLN', revenue: 1e9 });
  assert.equal(prepareDashboard(2026, input).salesTotal, 360.36);
});
test('top five plus Others aggregates remainder exactly in cents', () => {
  const data = dashboard(); assert.equal(data.customerSales.length, 6); assert.equal(data.customerSales[5].id, null); assert.equal(data.customerSales[5].revenue, 60.06);
  assert.equal(data.customerSales.reduce((sum, row) => sum + Math.round(row.revenue * 100), 0), 36036);
});
test('six or fewer customers are all retained', () => {
  for (const count of [1, 5, 6]) { const input = sources(); input.sales = ready(sales(count)); const data = prepareDashboard(2026, input); assert.equal(data.customerSales.length, count); assert.ok(data.customerSales.every(row => row.id !== null)); }
});
for (const key of ['annual', 'sales', 'cash', 'liquidity']) test(`missing ${key} is isolated`, () => {
  const input = sources(); input[key] = { state: 'unavailable', value: null }; const data = prepareDashboard(2026, input);
  assert.equal(data.completeness[key].state, 'unavailable');
  if (key !== 'annual') assert.equal(data.kpis.sales, 1200);
  if (key !== 'sales') assert.equal(data.salesTotal, 360.36);
  if (key === 'cash') assert.equal(data.kpis.endingCash, null);
  if (key === 'liquidity') assert.equal(data.kpis.liquidityGap, null);
});
test('NULL differs from explicit zero, including wholly blank saved budgets', () => {
  const input = sources(); input.annual.value.forEach(row => BUDGET_INPUTS.forEach(key => row[key] = null));
  let data = prepareDashboard(2026, input); assert.equal(data.kpis.sales, null); assert.equal(data.completeness.annual.state, 'empty'); assert.equal(data.profitabilityMonths[0].costs, null);
  input.annual.value[0].sales_amount = 0; data = prepareDashboard(2026, input); assert.equal(data.kpis.sales, 0); assert.equal(data.completeness.annual.state, 'ready');
});
test('completeness includes missing months and canonical production input', () => {
  const input = sources(); input.annual.value.pop(); input.annual.value[0].production_m3 = null;
  const data = prepareDashboard(2026, input); assert.equal(data.completeness.annual.missing, 10); assert.equal(data.completeness.annual.expected, 108); assert.equal(data.profitabilityMonths[11].sales, null);
});
test('complete explicit-zero budgets are not incomplete', () => {
  const input = sources(); input.annual.value.forEach(row => BUDGET_INPUTS.forEach(key => row[key] = 0));
  const data = prepareDashboard(2026, input); assert.equal(data.completeness.annual.missing, 0); assert.equal(data.kpis.costs, 0);
});
test('month drilldown keeps year and month', () => {
  assert.equal(monthLink('annual', 2029, 7), '/budget/annual?year=2029&month=7');
  assert.equal(prepareDashboard(2029, sources()).liquidityMonths[6].href, '/budget/liquidity?year=2029&month=7');
});
test('customer and Others drilldown keep year and preserve business names', () => {
  const data = dashboard(); assert.equal(data.customerSales[0].href, '/sales/customers/c0?year=2026'); assert.equal(data.customerSales[0].name, 'Customer 0'); assert.equal(data.customerSales[5].href, '/sales/customers?year=2026'); assert.equal(customerLink(2030, 'a/b'), '/sales/customers/a%2Fb?year=2030');
});
test('Sales facts and annual budget remain independent and discrepancy is explicit', () => { const data = dashboard(); assert.equal(data.salesTotal, 360.36); assert.equal(data.kpis.sales, 1200); assert.equal(data.salesDifference, -839.64); });
test('negative sales are retained but never misrepresented as positive donut slices', () => { const input = sources(); input.sales.value.customers[0].revenue = -1; const data = prepareDashboard(2026, input); assert.equal(data.donutRenderable, false); });

function serviceHarness(context = { selectedOrganizationId: 'org-A', selectedOrganization: { name: 'Business' } }, fail) {
  const calls = [];
  const read = (name, value) => async (...args) => { calls.push([name, ...args]); if (name === fail) throw new Error('offline'); return value; };
  const { loadDashboardData } = loadModule('src/lib/dashboard/service.ts', {
    '@/lib/budget/service': { requireBudgetContext: async () => { if (context instanceof Error) throw context; return context; }, loadAnnualBudget: read('annual', { ready: true, rows: annual() }) },
    '@/lib/budget/cash-flow-service': { loadCashFlowBudget: read('cash', { ready: true, rows: cash(), openingBalance: 1000, missingYear: null }) },
    '@/lib/budget/liquidity-service': { loadLiquidityForecast: read('liquidity', { ready: true, rows: liquidity() }) },
    '@/lib/sales/service': { getSalesReport: read('sales', sales()) },
  });
  return { loadDashboardData, calls };
}
test('all reads use authenticated organization and selected year', async () => { const h = serviceHarness(); await h.loadDashboardData('2029'); assert.equal(h.calls.length, 4); for (const call of h.calls) assert.deepEqual(call.slice(1), ['org-A', 2029]); });
test('System Admin without selection performs no data reads', async () => { const h = serviceHarness({ selectedOrganizationId: null, isSystemAdmin: true }); assert.equal((await h.loadDashboardData(2026)).kind, 'no-organization'); assert.equal(h.calls.length, 0); });
test('invalid year does not read any sources', async () => { const h = serviceHarness(); for (const year of ['wrong', 2019, 2101, ['2026'], null]) assert.equal((await h.loadDashboardData(year)).kind, 'invalid-year'); assert.equal(h.calls.length, 0); });
test('authorization failure is never swallowed as an empty source', async () => { const h = serviceHarness(new Error('FORBIDDEN')); await assert.rejects(h.loadDashboardData(2026), /FORBIDDEN/); assert.equal(h.calls.length, 0); });
test('each rejected source leaves independent sources usable', async () => { for (const key of ['annual', 'cash', 'liquidity', 'sales']) { const h = serviceHarness(undefined, key); const result = await h.loadDashboardData(2026); assert.equal(result.kind, 'ready'); assert.equal(result.data.completeness[key].state, 'error'); if (key !== 'annual') assert.equal(result.data.kpis.sales, 1200); } });
test('all four independent reads start before any read finishes', async () => {
  let started = 0; let release; const gate = new Promise(resolve => release = resolve);
  const wait = value => async () => { started++; await gate; return value; };
  const { loadDashboardData } = loadModule('src/lib/dashboard/service.ts', {
    '@/lib/budget/service': { requireBudgetContext: async () => ({ selectedOrganizationId: 'org-A' }), loadAnnualBudget: wait({ ready: true, rows: [] }) },
    '@/lib/budget/cash-flow-service': { loadCashFlowBudget: wait({ ready: true, rows: [], openingBalance: null, missingYear: 2025 }) },
    '@/lib/budget/liquidity-service': { loadLiquidityForecast: wait({ ready: true, rows: [] }) },
    '@/lib/sales/service': { getSalesReport: wait(sales(0)) },
  });
  const pending = loadDashboardData(2026); await new Promise(resolve => setImmediate(resolve)); assert.equal(started, 4); release(); await pending;
});

test('responsive rendering with real Recharts and shared UI works in FI/PL/EN, including empty sources', async () => {
  const React = await import('react'); const { renderToStaticMarkup } = await import('react-dom/server');
  const icon = loadModule('src/components/ui/icon.tsx', { react: React });
  const ui = loadModule('src/components/ui/core.tsx', { react: React, './icon': icon });
  const mocks = { react: React, '@/components/ui': ui, 'next/navigation': { useRouter: () => ({ push() {} }) }, 'next/link': ({ children, ...props }) => React.createElement('a', props, children) };
  const charts = loadModule('src/components/dashboard/charts.tsx', mocks);
  const { ManagementDashboard } = loadModule('src/components/dashboard/management-dashboard.tsx', { ...mocks, './charts': charts });
  for (const locale of ['fi', 'pl', 'en']) {
    for (const input of [sources(), Object.fromEntries(['annual', 'cash', 'liquidity', 'sales'].map(key => [key, { state: 'empty', value: null }]))]) {
      const html = renderToStaticMarkup(React.createElement(ManagementDashboard, { locale, data: prepareDashboard(2026, input) }));
      assert.match(html, /grid-cols-1/); assert.match(html, /xl:grid-cols-2/); assert.match(html, /xl:grid-cols-6/); assert.doesNotMatch(html, /NaN|Infinity|undefined/);
      if (input.annual.value) { assert.match(html, /budget\/annual\?year=2026&amp;month=7/); assert.match(html, /sales\/customers\/c0\?year=2026/); assert.match(html, /Customer 0/); }
    }
  }
});
