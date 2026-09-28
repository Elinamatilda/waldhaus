import 'server-only';
import { budgetYear } from '@/lib/budget/model';
import { loadAnnualBudget, requireBudgetContext } from '@/lib/budget/service';
import { loadCashFlowBudget } from '@/lib/budget/cash-flow-service';
import { loadLiquidityForecast } from '@/lib/budget/liquidity-service';
import { getSalesReport } from '@/lib/sales/service';
import { prepareDashboard, type Source } from './model';

// The organization always comes from authenticated request context, never URL input.
export async function loadDashboardData(input: unknown) {
  const context = await requireBudgetContext();
  let year: number;
  try { if (typeof input !== 'string' && typeof input !== 'number') throw new Error('INVALID_YEAR'); year = budgetYear(input); } catch { return { kind: 'invalid-year' as const, context }; }
  if (!context.selectedOrganizationId) return { kind: 'no-organization' as const, context, year };
  const organization = context.selectedOrganizationId;
  // A failed read never prevents independent sources from rendering.
  async function read<T>(loader: () => Promise<Source<T>>): Promise<Source<T>> {
    try { return await loader(); } catch { return { state: 'error', value: null }; }
  }
  const [annual, cash, liquidity, sales] = await Promise.all([
    read(async () => { const data = await loadAnnualBudget(organization, year); return { state: data.ready ? 'ready' : 'unavailable', value: data.rows }; }),
    read(async () => { const data = await loadCashFlowBudget(organization, year); return { state: data.ready ? 'ready' : 'unavailable', value: data }; }),
    read(async () => { const data = await loadLiquidityForecast(organization, year); return { state: data.ready ? 'ready' : 'unavailable', value: data.rows }; }),
    read(async () => ({ state: 'ready', value: await getSalesReport(organization, year) })),
  ]);
  return { kind: 'ready' as const, context, data: prepareDashboard(year, { annual, cash, liquidity, sales }) };
}
