import { budgetYear } from './model';

export const LIQUIDITY_INPUTS = ['opening_balance','forecasted_sales','other_forecasted_income','total_outflows'] as const;
export type LiquidityInput = typeof LIQUIDITY_INPUTS[number];
export type LiquidityValues = Record<LiquidityInput,number|null>;
export type LiquidityDraft = Record<LiquidityInput,string>;
export type LiquidityRow = LiquidityValues & {id:string;month_number:number;edit_version:string};
export function emptyLiquidity():LiquidityValues {
  return {opening_balance:null,forecasted_sales:null,other_forecasted_income:null,total_outflows:null};
}
export function liquidityNumber(value:unknown,field:LiquidityInput):number|null {
  if(typeof value!=='string')throw new Error('INVALID_INPUT');
  const text=value.trim().replace(',','.');
  if(!text)return null;
  if(!(field==='opening_balance'?/^-?\d+(?:\.\d{1,2})?$/:/^\d+(?:\.\d{1,2})?$/).test(text))throw new Error('INVALID_INPUT');
  const number=Number(text);
  if(!Number.isFinite(number)||Math.abs(number)>=1e12)throw new Error('INVALID_INPUT');
  return number;
}
export function parseLiquidityDraft(draft:LiquidityDraft[]):LiquidityValues[] {
  if(draft.length!==12)throw new Error('INVALID_INPUT');
  return draft.map(row=>{
    const values=emptyLiquidity();
    for(const field of LIQUIDITY_INPUTS)values[field]=liquidityNumber(row[field],field);
    return values;
  });
}
export function deriveLiquidity(values:LiquidityValues) {
  const cents={} as Record<LiquidityInput,number>;
  for(const field of LIQUIDITY_INPUTS){
    const value=values[field]===null?0:values[field];
    if(!Number.isFinite(value)||Math.abs(value)>=1e12||(field!=='opening_balance'&&value<0))throw new Error('INVALID_INPUT');
    cents[field]=Math.round(value*100);
  }
  const inflows=cents.forecasted_sales+cents.other_forecasted_income;
  const net=inflows-cents.total_outflows;
  // 30% of outflows, rounded to cents. Never use a legacy manually saved target.
  const minimum=Math.round(cents.total_outflows*3/10);
  // TOTAL sales required, independent of existing forecasted sales.
  const required=Math.max(0,minimum-cents.opening_balance-cents.other_forecasted_income+cents.total_outflows);
  return {...values,minimum_required_balance:minimum/100,total_inflows:inflows/100,net_cash_flow:net/100,closing_balance:(cents.opening_balance+net)/100,
    sales_needed:required/100,additional_sales_needed:Math.max(0,required-cents.forecasted_sales)/100};
}
export function calculateLiquidity(months:LiquidityValues[]) {
  if(months.length!==12)throw new Error('INVALID_INPUT');
  // No carry-forward: each month uses its own optional canonical opening input.
  const rows=months.map((month,i)=>({...deriveLiquidity(month),month_number:i+1}));
  const sum=(field:'forecasted_sales'|'other_forecasted_income'|'total_inflows'|'total_outflows'|'net_cash_flow')=>rows.reduce((total,row)=>total+Math.round((row[field]??0)*100),0)/100;
  const lowest=rows.reduce((min,row)=>row.closing_balance<min.closing_balance?row:min,rows[0]);
  return {rows,totals:{opening_balance:null,closing_balance:null,minimum_required_balance:null,sales_needed:null,
    forecasted_sales:sum('forecasted_sales'),other_forecasted_income:sum('other_forecasted_income'),total_inflows:sum('total_inflows'),total_outflows:sum('total_outflows'),net_cash_flow:sum('net_cash_flow')},
    kpis:{forecasted_sales:sum('forecasted_sales'),net_cash_flow:sum('net_cash_flow'),lowest_closing_balance:lowest.closing_balance,
      lowest_balance_month:lowest.month_number,largest_sales_requirement:Math.max(...rows.map(row=>row.sales_needed))}};
}
export function parseLiquidityForm(form:FormData) {
  const year=budgetYear(form.get('year'));
  const months=Array.from({length:12},(_,i)=>{
    const values=emptyLiquidity();
    for(const field of LIQUIDITY_INPUTS)values[field]=liquidityNumber(form.get(`${field}_${i+1}`),field);
    const version=form.get(`version_${i+1}`);
    if(typeof version!=='string'||(version!==''&&(!/^\d{1,19}$/.test(version)||BigInt(version)>BigInt('9223372036854775807'))))throw new Error('INVALID_INPUT');
    // The existing RPC still requires this key. Compute it server-side from
    // canonical outflows rather than accepting a client-provided target.
    return {...values,minimum_required_balance:deriveLiquidity(values).minimum_required_balance,
      month_number:i+1,expected_version:version===''?null:BigInt(version).toString()};
  });
  return {year,months};
}
export type LiquiditySubmission=ReturnType<typeof parseLiquidityForm>;
