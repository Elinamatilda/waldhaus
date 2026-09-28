import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
const model=loadModule('src/lib/budget/cash-flow-model.ts');
const months=()=>Array.from({length:12},()=>({...model.emptyCashFlows(),sales_revenue:100,other_income:20,operating_costs:50,investments:30,loan_payments:10}));
function form(year=2026){
 const f=new FormData();f.set('organization_id','org-a');f.set('year',String(year));f.set('opening_balance','-100');
 months().forEach((row,i)=>{f.set(`version_${i+1}`,'');for(const field of model.CASH_FLOW_INPUTS)f.set(`${field}_${i+1}`,String(row[field]));});return f;
}
function fixture(context={selectedOrganizationId:'org-a'},error=null){
 const calls=[];
 const action=loadModule('src/app/actions/cash-flow-budget.ts',{
  'next/cache':{revalidatePath(){}},
  '@/lib/budget/service':{requireBudgetContext:async()=>{if(context instanceof Error)throw context;return context;}},
  '@/lib/budget/cash-flow-service':{persistCashFlowBudget:async(org,input)=>{calls.push({org,input});return {error,data:{year:input.year,months:input.months.map((row,i)=>({month_number:i+1,edit_version:String(BigInt('9007199254740993')+BigInt(i))}))}};}},
 }).saveCashFlowBudgetAction;return {action,calls};
}
test('cash chain uses January input, exact flow formulas and negative balances through December',()=>{
 const result=model.calculateCashFlow(-100,months());
 assert.equal(result.rows[0].opening_balance,-100);assert.equal(result.rows[0].total_inflows,120);
 assert.equal(result.rows[0].total_outflows,90);assert.equal(result.rows[0].closing_balance,-70);
 for(let i=1;i<12;i++)assert.equal(result.rows[i].opening_balance,result.rows[i-1].closing_balance);
 assert.equal(result.rows[11].closing_balance,260);
 assert.deepEqual(result.kpis,{starting_cash:-100,ending_cash:260,lowest_closing_balance:-70,lowest_balance_month:1,net_cash_flow:360});
 assert.equal(result.totals.opening_balance,-100);assert.equal(result.totals.closing_balance,260);
 assert.equal(result.totals.total_inflows,1440);assert.equal(result.totals.total_outflows,1080);
});
test('earlier edits change every downstream balance; totals never sum balances',()=>{
 const original=model.calculateCashFlow(100,months());const changed=months();changed[0].investments+=500;
 const result=model.calculateCashFlow(100,changed);
 result.rows.forEach((row,i)=>assert.equal(row.closing_balance,original.rows[i].closing_balance-500));
 assert.equal(result.totals.opening_balance,100);assert.equal(result.totals.closing_balance,result.rows[11].closing_balance);
});
test('cash decimals use integer cents and first minimum month wins ties',()=>{
 const rows=Array.from({length:12},()=>({...model.emptyCashFlows(),sales_revenue:0.1,other_income:0.2,operating_costs:0.3}));
 const r=model.calculateCashFlow(0,rows);assert.equal(r.kpis.ending_cash,0);assert.equal(r.kpis.lowest_balance_month,1);
});
test('malformed, negative flow, excessive precision, missing inputs and oversized versions cause zero writes',async()=>{
 for(const [key,value] of [['loan_payments_12','bad'],['sales_revenue_1','-1'],['opening_balance','1.001'],['version_1','9223372036854775808'],['investments_12',null]]){
  const f=form();if(value===null)f.delete(key);else f.set(key,value);
  const {action,calls}=fixture();assert.equal((await action(f)).code,'INVALID_INPUT');assert.equal(calls.length,0);
 }
});
test('one atomic submission for selected System Admin organization and independent years',async()=>{
 const {action,calls}=fixture();await action(form(2025));await action(form(2027));
 assert.deepEqual(calls.map(c=>c.input.year),[2025,2027]);
 for(const call of calls){assert.equal(call.org,'org-a');assert.equal(call.input.months.length,12);assert.equal(call.input.opening,-100);}
});
test('other organization, missing selection and denied Employee cannot write',async()=>{
 for(const context of [{selectedOrganizationId:'org-b'},{selectedOrganizationId:null},Object.assign(new Error('forbidden'),{digest:'NEXT_HTTP_ERROR_FALLBACK;403'})]){
  const {action,calls}=fixture(context);assert.equal((await action(form())).code,'FORBIDDEN');assert.equal(calls.length,0);
 }
});
test('stale cash edit is reported without retry',async()=>{
 const {action,calls}=fixture(undefined,{code:'40001'});assert.equal((await action(form())).code,'CONFLICT');assert.equal(calls.length,1);
});

test('blank flow is canonical NULL, explicit zero stays zero, opening is required',async()=>{
 const f=form();f.set('sales_revenue_1','');f.set('sales_revenue_2','0');
 const {action,calls}=fixture();assert.equal((await action(f)).ok,true);
 assert.equal(calls[0].input.months[0].sales_revenue,null);assert.equal(calls[0].input.months[1].sales_revenue,0);
 f.set('opening_balance','');const denied=fixture();assert.equal((await denied.action(f)).code,'INVALID_INPUT');assert.equal(denied.calls.length,0);
});
test('nullable flows calculate as zero without modifying canonical values',()=>{
 const rows=Array.from({length:12},()=>model.emptyCashFlows());
 const result=model.calculateCashFlow(-42,rows);
 assert.equal(result.kpis.ending_cash,-42);assert.equal(result.totals.total_inflows,0);assert.equal(result.totals.total_outflows,0);
 assert.ok(rows.every(row=>row.sales_revenue===null));assert.ok(result.rows.every(row=>row.sales_revenue===null&&row.opening_balance===-42));
});

test('save returns all fresh bigint tokens losslessly for the next edit',async()=>{
 const {action}=fixture();const result=await action(form());assert.equal(result.ok,true);
 assert.equal(result.saved.year,2026);assert.equal(result.saved.months.length,12);
 assert.equal(result.saved.months[0].edit_version,'9007199254740993');
 const next=form();result.saved.months.forEach(row=>next.set(`version_${row.month_number}`,row.edit_version));
 assert.equal(model.parseCashFlowForm(next).months[0].expected_version,'9007199254740993');
});
test('incomplete or rounded version responses cannot be accepted as successful saves',()=>{
 assert.throws(()=>model.cashFlowSaved({year:2026,months:[]},2026));
 assert.throws(()=>model.cashFlowSaved({year:2026,months:Array.from({length:12},(_,i)=>({month_number:i+1,edit_version:123}))},2026));
});
