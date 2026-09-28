export const BUDGET_INPUTS = [
  'sales_amount', 'raw_material_cost', 'energy_cost', 'labor_cost',
  'maintenance_repairs_cost', 'transportation_logistics_cost',
  'administration_sales_cost', 'waste_environmental_cost', 'production_m3',
] as const;
export type BudgetInput = typeof BUDGET_INPUTS[number];
export type BudgetValues = Record<BudgetInput, number | null>;
// edit_version is bigint in PostgreSQL; text transport avoids JS integer rounding.
export type BudgetRow = BudgetValues & { month_number:number; edit_version:string; id:string };
export const BUDGET_DERIVED = ['total_cost','cost_per_m3','profit_margin_amount','profit_margin_percent'] as const;
export const BUDGET_YEARS = Array.from({length:81},(_,i)=>2020+i);
export function emptyBudget():BudgetValues {
  return {sales_amount:null,raw_material_cost:null,energy_cost:null,labor_cost:null,maintenance_repairs_cost:null,
    transportation_logistics_cost:null,administration_sales_cost:null,waste_environmental_cost:null,production_m3:null};
}
export function budgetYear(value:unknown):number {
  const year=Number(value);
  if (!Number.isInteger(year) || year<2020 || year>2100) throw new Error('INVALID_YEAR');
  return year;
}
export function budgetNumber(value:unknown, field:BudgetInput):number | null {
  if(typeof value!=='string') throw new Error('INVALID_INPUT');
  const text=value.trim().replace(',','.');
  if (!text) return null;
  const pattern=field==='production_m3'? /^\d+(?:\.\d{1,6})?$/ : /^\d+(?:\.\d{1,2})?$/;
  if(!pattern.test(text)) throw new Error('INVALID_INPUT');
  const number=Number(text);
  if(!Number.isFinite(number) || number>=1e12) throw new Error('INVALID_INPUT');
  return number;
}
export function deriveBudget(values:BudgetValues) {
  // Money is summed in integer cents, rather than accumulating binary fractions.
  const costs=BUDGET_INPUTS.filter(field=>field!=='sales_amount' && field!=='production_m3');
  const costCents=costs.reduce((sum,field)=>sum+Math.round((values[field]??0)*100),0);
  const marginCents=Math.round((values.sales_amount??0)*100)-costCents;
  return {total_cost:costCents/100,
    cost_per_m3:values.production_m3!==null && values.production_m3>0?costCents/100/values.production_m3:null,
    profit_margin_amount:marginCents/100,
    profit_margin_percent:values.sales_amount!==null && values.sales_amount>0?marginCents/values.sales_amount:null};
}
export function totalBudget(rows:BudgetValues[]):Record<BudgetInput,number> {
  const total = {} as Record<BudgetInput,number>;
  for(const field of BUDGET_INPUTS) {
    const scale=field==='production_m3'?1e6:100;
    // BigInt keeps volume totals exact even for many high-precision inputs.
    const sum=rows.reduce((value,row)=>value+BigInt(Math.round((row[field]??0)*scale)),BigInt(0));
    total[field]=Number(sum)/scale;
  }
  return total;
}
export type BudgetSubmission = {year:number; months:Array<BudgetValues & {month_number:number;expected_version:string|null}>};
export function parseBudgetForm(form:FormData):BudgetSubmission {
  const year=budgetYear(form.get('year'));
  const months=Array.from({length:12},(_,index)=>{
    const month_number=index+1;
    const values=emptyBudget();
    for(const field of BUDGET_INPUTS) values[field]=budgetNumber(form.get(`${field}_${month_number}`),field);
    const version=form.get(`version_${month_number}`);
    if(typeof version!=='string' || (version!=='' && !/^[0-9]{1,19}$/.test(version))) throw new Error('INVALID_INPUT');
    if(version!=='' && BigInt(version)>BigInt('9223372036854775807')) throw new Error('INVALID_INPUT');
    // Strings are lossless transport only; the RPC casts and compares bigint values.
    return {...values,month_number,expected_version:version===''?null:BigInt(version).toString()};
  });
  return {year,months};
}
export type BudgetResult = {ok:true} | {ok:false;code:'INVALID_INPUT'|'CONFLICT'|'FORBIDDEN'|'UNAVAILABLE'|'DATABASE_ERROR'};
