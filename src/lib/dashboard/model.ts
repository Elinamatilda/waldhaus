import { customerShare, customerSalesLink } from '@/lib/sales/customer-share';
import { BUDGET_INPUTS, deriveBudget, emptyBudget, totalBudget, type BudgetRow } from '@/lib/budget/model';
import { CASH_FLOW_INPUTS, calculateCashFlow, emptyCashFlows, type CashFlowRow } from '@/lib/budget/cash-flow-model';
import { LIQUIDITY_INPUTS, deriveLiquidity, emptyLiquidity, type LiquidityRow } from '@/lib/budget/liquidity-model';
import type { SalesReport } from '@/lib/sales/service';

export type SourceState = 'ready' | 'empty' | 'unavailable' | 'error';
export type Completeness = { state: SourceState; missing: number; expected: number };
export type Source<T> = { state: SourceState; value: T | null };
export type CashSource = { rows: CashFlowRow[]; openingBalance: number | null; missingYear: number | null };
export type DashboardSources = { annual: Source<BudgetRow[]>; cash: Source<CashSource>; liquidity: Source<LiquidityRow[]>; sales: Source<SalesReport> };
export const monthLink = (section: 'annual' | 'liquidity', year: number, month: number) => `/budget/${section}?year=${year}&month=${month}`;
export const customerLink = customerSalesLink;
const sumMoney = (values: number[]) => Number(values.reduce((sum, value) => sum + BigInt(Math.round(value * 100)), BigInt(0))) / 100;
function monthly<T extends { month_number: number }>(rows: T[], empty: () => Omit<T, 'month_number'>) {
  return Array.from({ length: 12 }, (_, i) => rows.find(row => row.month_number === i + 1) ?? { ...empty(), month_number: i + 1 });
}
function completeness<T>(source: Source<unknown>, rows: T[], fields: readonly (keyof T)[]): Completeness {
  const missing = rows.reduce((sum, row) => sum + fields.filter(field => row[field] == null).length, 0);
  const expected = rows.length * fields.length;
  return { state: source.state === 'ready' && missing === expected ? 'empty' : source.state, missing, expected };
}
export function prepareDashboard(year: number, sources: DashboardSources) {
  const annualRows = monthly(sources.annual.value ?? [], () => ({ ...emptyBudget(), id: '', edit_version: '' }));
  const cashRows = monthly(sources.cash.value?.rows ?? [], () => ({ ...emptyCashFlows(), opening_balance: null, id: '', edit_version: '' }));
  const liquidityRows = monthly(sources.liquidity.value ?? [], () => ({ ...emptyLiquidity(), id: '', edit_version: '' }));
  const annual = completeness(sources.annual, annualRows, BUDGET_INPUTS);
  const cash = completeness(sources.cash, cashRows, CASH_FLOW_INPUTS);
  const liquidity = completeness(sources.liquidity, liquidityRows, LIQUIDITY_INPUTS);
  const totals = totalBudget(annualRows);
  const costs = BUDGET_INPUTS.filter(key => key !== 'sales_amount' && key !== 'production_m3');
  const hasSales = annual.state === 'ready' && annualRows.some(row => row.sales_amount !== null);
  const hasCosts = annual.state === 'ready' && annualRows.some(row => costs.some(key => row[key] !== null));
  const derived = deriveBudget(totals);
  const profitabilityMonths = annualRows.map(row => {
    const values = deriveBudget(row);
    const present = annual.state === 'ready';
    const sales = present ? row.sales_amount : null;
    const totalCost = present && costs.some(key => row[key] !== null) ? values.total_cost : null;
    return { month: row.month_number, sales, costs: totalCost,
      margin: sales !== null && totalCost !== null ? values.profit_margin_percent : null,
      href: monthLink('annual', year, row.month_number) };
  });
  const liquidityMonths = liquidityRows.map(row => {
    const present = liquidity.state === 'ready' && LIQUIDITY_INPUTS.some(key => row[key] !== null);
    const values = deriveLiquidity(row);
    return { month: row.month_number, closing: present ? values.closing_balance : null,
      minimum: present ? values.minimum_required_balance : null,
      gap: present ? sumMoney([values.closing_balance, -values.minimum_required_balance]) : null,
      href: monthLink('liquidity', year, row.month_number) };
  });
  const worst = liquidityMonths.filter(row => row.gap !== null).reduce<typeof liquidityMonths[number] | null>((min, row) => !min || row.gap! < min.gap! ? row : min, null);
  const opening = sources.cash.value?.openingBalance;
  const endingCash = cash.state === 'ready' && opening != null ? calculateCashFlow(opening, cashRows).kpis.ending_cash : null;
  const customers = (sources.sales.value?.customers ?? []).filter(row => row.scenario === 'BUDGET' && row.currency_code === 'EUR')
    .sort((a, b) => b.revenue - a.revenue || a.customer_id.localeCompare(b.customer_id));
  const salesTotals = (sources.sales.value?.totals ?? []).filter(row => row.scenario === 'BUDGET' && row.currency_code === 'EUR');
  const sales: Completeness = { state: sources.sales.state === 'ready' && !salesTotals.length && !customers.length ? 'empty' : sources.sales.state, missing: 0, expected: 0 };
  const salesTotal = sales.state === 'ready' ? sumMoney(salesTotals.map(row => row.revenue)) : null;
  const share = customerShare(customers.map(row => ({ customerId: row.customer_id, customerName: row.customer_name, revenue: row.revenue })), year);
  const customerSales = share.slices;
  return { year, completeness: { annual, cash, liquidity, sales },
    kpis: { sales: hasSales ? totals.sales_amount : null, costs: hasCosts ? derived.total_cost : null,
      profit: hasSales && hasCosts ? derived.profit_margin_amount : null,
      margin: hasSales && hasCosts ? derived.profit_margin_percent : null,
      endingCash, liquidityGap: worst?.gap ?? null, liquidityMonth: worst?.month ?? null },
    cashMissingYear: sources.cash.value?.missingYear ?? null,
    profitabilityMonths, liquidityMonths, monthlyCosts: profitabilityMonths.map(({ month, costs, href }) => ({ month, costs, href })),
    customerSales, salesTotal,
    salesDifference: salesTotal !== null && hasSales ? sumMoney([salesTotal, -totals.sales_amount]) : null,
    donutRenderable: share.renderable,
  };
}
export type DashboardData = ReturnType<typeof prepareDashboard>;
