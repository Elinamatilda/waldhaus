import type { ScenarioCode } from './service';

export type CustomerRevenue = { customerId: string; customerName: string; revenue: number };
export type CustomerShareSlice = { id: string | null; name: string; revenue: number; href: string };
export function sumSalesMoney(values: readonly number[]): number {
  const cents = values.reduce((sum, value) => {
    if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) throw new Error('INVALID_SALES_AMOUNT');
    return sum + BigInt(Math.round(value * 100));
  }, BigInt(0));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('SALES_TOTAL_OUT_OF_RANGE');
  return Number(cents) / 100;
}
export function customerSalesLink(year: number, id: string | null, scenario?: ScenarioCode) {
  return `/sales/customers${id === null ? '' : `/${encodeURIComponent(id)}`}?year=${year}${scenario ? `&scenario=${scenario}` : ''}`;
}
export function rankedCustomerRevenue(customers: readonly CustomerRevenue[]) {
  return [...customers].sort((a, b) => b.revenue - a.revenue || a.customerId.localeCompare(b.customerId));
}
/** Shared by the management dashboard and the full customer analysis. */
export function customerShare(customers: readonly CustomerRevenue[], year: number, scenario?: ScenarioCode) {
  const ranked = rankedCustomerRevenue(customers);
  const visible = ranked.length > 6 ? ranked.slice(0, 5) : ranked;
  const slices: CustomerShareSlice[] = visible.map(row => ({ id: row.customerId, name: row.customerName, revenue: row.revenue, href: customerSalesLink(year, row.customerId, scenario) }));
  if (ranked.length > 6) slices.push({ id: null, name: '', revenue: sumSalesMoney(ranked.slice(5).map(row => row.revenue)), href: customerSalesLink(year, null, scenario) });
  return { slices, renderable: ranked.length > 0 && ranked.every(row => row.revenue >= 0) && ranked.some(row => row.revenue > 0) };
}
