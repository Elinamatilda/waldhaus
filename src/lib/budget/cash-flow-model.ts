import { budgetYear } from './model';

export const CASH_FLOW_INPUTS = ['sales_revenue','other_income','operating_costs','investments','loan_payments'] as const;
export type CashFlowInput = typeof CASH_FLOW_INPUTS[number];
export type CashFlows = Record<CashFlowInput,number|null>;
type CashAmounts = Record<CashFlowInput,number>;
export type CashFlowRow = CashFlows & {id:string;month_number:number;opening_balance:number|null;edit_version:string};
export type CashFlowDraft = Record<CashFlowInput,string>;
export const CASH_FLOW_START_YEAR = 2025;
export type CashFlowHistoryRow = CashFlowRow & {year_number:number};

/** 2025 is the saved seed. Later stored January values are compatibility snapshots. */
export function resolveCashFlowOpening(year:number,history:CashFlowHistoryRow[]) {
  budgetYear(year);
  const seed=history.find(row=>row.year_number===CASH_FLOW_START_YEAR&&row.month_number===1)?.opening_balance;
  if(year<CASH_FLOW_START_YEAR||seed==null)return {openingBalance:null,missingYear:CASH_FLOW_START_YEAR};
  let opening=seed;
  for(let previous=CASH_FLOW_START_YEAR;previous<year;previous++){
    const rows=history.filter(row=>row.year_number===previous).sort((a,b)=>a.month_number-b.month_number);
    if(rows.length!==12||rows.some((row,index)=>row.month_number!==index+1))return {openingBalance:null,missingYear:previous};
    opening=calculateCashFlow(opening,rows).rows[11].closing_balance;
  }
  return {openingBalance:opening,missingYear:null};
}
export function emptyCashFlows():CashFlows {
  return {sales_revenue:null,other_income:null,operating_costs:null,investments:null,loan_payments:null};
}
export function cashNumber(value:unknown,allowNegative:true):number;
export function cashNumber(value:unknown,allowNegative?:false):number|null;
export function cashNumber(value:unknown,allowNegative=false):number|null {
  if(typeof value!=='string') throw new Error('INVALID_INPUT');
  const text=value.trim().replace(',','.');
  if(!text) {if(allowNegative)throw new Error('INVALID_INPUT');return null;}
  if(!(allowNegative?/^-?\d+(?:\.\d{1,2})?$/:/^\d+(?:\.\d{1,2})?$/).test(text)) throw new Error('INVALID_INPUT');
  const number=Number(text);
  if(!Number.isFinite(number)||Math.abs(number)>=1e12) throw new Error('INVALID_INPUT');
  return number;
}
export function parseCashFlowDraft(opening:string,months:CashFlowDraft[]) {
  if(months.length!==12)throw new Error('INVALID_INPUT');
  return {opening:cashNumber(opening,true),months:months.map(row=>{
    const parsed=emptyCashFlows();
    for(const field of CASH_FLOW_INPUTS)parsed[field]=cashNumber(row[field]);
    return parsed;
  })};
}
export function calculateCashFlow(opening:number,months:CashFlows[]) {
  if(months.length!==12 || !Number.isFinite(opening) || Math.abs(opening)>=1e12) throw new Error('INVALID_INPUT');
  // Input cap guarantees the entire 12-month chain remains within safe integer cents.
  let balance=Math.round(opening*100);
  const flowTotals=Object.fromEntries(CASH_FLOW_INPUTS.map(field=>[field,0])) as CashAmounts;
  const rows=months.map((month,index)=>{
    const cents={} as CashAmounts;
    for(const field of CASH_FLOW_INPUTS) {
      const value=month[field]===null?0:month[field];
      if(!Number.isFinite(value)||value<0||value>=1e12)throw new Error('INVALID_INPUT');
      cents[field]=Math.round(value*100);
      flowTotals[field]+=cents[field];
    }
    const inflows=cents.sales_revenue+cents.other_income;
    const outflows=cents.operating_costs+cents.investments+cents.loan_payments;
    const start=balance;
    balance+=inflows-outflows;
    return {...month,month_number:index+1,opening_balance:start/100,total_inflows:inflows/100,total_outflows:outflows/100,closing_balance:balance/100};
  });
  const inflows=flowTotals.sales_revenue+flowTotals.other_income;
  const outflows=flowTotals.operating_costs+flowTotals.investments+flowTotals.loan_payments;
  const lowest=rows.reduce((min,row)=>row.closing_balance<min.closing_balance?row:min,rows[0]);
  return {rows,totals:{
    ...Object.fromEntries(CASH_FLOW_INPUTS.map(field=>[field,flowTotals[field]/100])) as CashFlows,
    opening_balance:Math.round(opening*100)/100,
    total_inflows:inflows/100,total_outflows:outflows/100,closing_balance:balance/100,
  },kpis:{starting_cash:Math.round(opening*100)/100,ending_cash:balance/100,
    lowest_closing_balance:lowest.closing_balance,lowest_balance_month:lowest.month_number,net_cash_flow:(inflows-outflows)/100}};
}
export function parseCashFlowForm(form:FormData) {
  const year=budgetYear(form.get('year'));
  const opening=cashNumber(form.get('opening_balance'),true);
  const months=Array.from({length:12},(_,index)=>{
    const month_number=index+1;
    const values=emptyCashFlows();
    for(const field of CASH_FLOW_INPUTS)values[field]=cashNumber(form.get(`${field}_${month_number}`));
    const version=form.get(`version_${month_number}`);
    if(typeof version!=='string'||(version!==''&&(!/^\d{1,19}$/.test(version)||BigInt(version)>BigInt('9223372036854775807'))))throw new Error('INVALID_INPUT');
    return {...values,month_number,expected_version:version||null};
  });
  return {year,opening,months};
}
export type CashFlowSubmission=ReturnType<typeof parseCashFlowForm>;

export {budgetSaved as cashFlowSaved, type BudgetSaved as CashFlowSaved} from './saved-versions';
