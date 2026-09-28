import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
const model=loadModule('src/lib/budget/liquidity-model.ts');
function form(year=2026){
 const f=new FormData();f.set('organization_id','org-a');f.set('year',String(year));
 for(let i=1;i<=12;i++){f.set(`version_${i}`,'');for(const field of model.LIQUIDITY_INPUTS)f.set(`${field}_${i}`,'');}return f;
}
function fixture(context={selectedOrganizationId:'org-a'},error=null){
 const calls=[];const paths=[];
 const action=loadModule('src/app/actions/liquidity-forecast.ts',{
  'next/cache':{revalidatePath:path=>paths.push(path)},
  '@/lib/budget/service':{requireBudgetContext:async()=>{if(context instanceof Error)throw context;return context;}},
  '@/lib/budget/liquidity-service':{persistLiquidityForecast:async(org,input)=>{calls.push({org,input});return {error,data:{year:input.year,months:input.months.map((row,i)=>({month_number:i+1,edit_version:String(100+i)}))}};}},
 }).saveLiquidityForecastAction;return {action,calls,paths};
}
test('workbook January and February remain independent, never chained',()=>{
 const rows=Array.from({length:12},()=>model.emptyLiquidity());
 rows[0].forecasted_sales=110074;rows[0].total_outflows=0;rows[1].forecasted_sales=92063.81;
 const result=model.calculateLiquidity(rows);
 assert.equal(result.rows[0].total_inflows,110074);assert.equal(result.rows[0].net_cash_flow,110074);assert.equal(result.rows[0].closing_balance,110074);
 assert.equal(result.rows[1].total_inflows,92063.81);assert.equal(result.rows[1].closing_balance,92063.81);assert.equal(result.rows[1].opening_balance,null);
 rows[0].opening_balance=5000;assert.equal(model.calculateLiquidity(rows).rows[1].closing_balance,92063.81);
});
test('TOTAL sales required and additional gap differ; negative opening and closing allowed',()=>{
 const row={opening_balance:-100,forecasted_sales:50,other_forecasted_income:20,total_outflows:80,minimum_required_balance:200};
 const r=model.deriveLiquidity(row);assert.equal(r.total_inflows,70);assert.equal(r.net_cash_flow,-10);assert.equal(r.closing_balance,-110);
 assert.equal(r.minimum_required_balance,24);assert.equal(r.sales_needed,184);assert.equal(r.additional_sales_needed,134);
 const covered=model.deriveLiquidity({...row,forecasted_sales:500});assert.equal(covered.sales_needed,184);assert.equal(covered.additional_sales_needed,0);
 assert.equal(model.deriveLiquidity({...row,opening_balance:1000}).sales_needed,0);
});
test('NULL and explicit zero remain distinct while calculations safely coalesce',()=>{
 const f=form();f.set('opening_balance_2','0');const parsed=model.parseLiquidityForm(f);
 assert.equal(parsed.months[0].opening_balance,null);assert.equal(parsed.months[1].opening_balance,0);
 assert.equal(model.deriveLiquidity(parsed.months[0]).closing_balance,0);
 assert.equal(model.deriveLiquidity(parsed.months[1]).closing_balance,0);
 for(const field of model.LIQUIDITY_INPUTS)assert.equal(parsed.months[0][field],null);
});
test('annual totals sum flows but omit independent balances and requirements; KPI minima use earliest tie',()=>{
 const rows=Array.from({length:12},()=>({opening_balance:-100,forecasted_sales:50,other_forecasted_income:20,total_outflows:80,minimum_required_balance:200}));
 const r=model.calculateLiquidity(rows);assert.equal(r.totals.forecasted_sales,600);assert.equal(r.totals.net_cash_flow,-120);
 for(const field of ['opening_balance','closing_balance','minimum_required_balance','sales_needed'])assert.equal(r.totals[field],null);
 assert.equal(r.kpis.lowest_closing_balance,-110);assert.equal(r.kpis.lowest_balance_month,1);assert.equal(r.kpis.largest_sales_requirement,184);
});
test('malformed last month, negative flow, excessive precision, missing property and invalid version make zero calls',async()=>{
 for(const [key,value] of [['forecasted_sales_12','bad'],['total_outflows_1','-1'],['opening_balance_2','0.001'],['total_outflows_3','1000000000000'],['version_1','9223372036854775808'],['other_forecasted_income_12',null]]){
  const f=form();if(value===null)f.delete(key);else f.set(key,value);const {action,calls}=fixture();assert.equal((await action(f)).code,'INVALID_INPUT');assert.equal(calls.length,0);
 }
});
test('selected organization and independent years submit exactly twelve rows and retain returned versions',async()=>{
 const {action,calls,paths}=fixture();for(const year of [2025,2026,2027]){const result=await action(form(year));assert.equal(result.ok,true);assert.equal(result.saved.months[11].edit_version,'111');}
 assert.deepEqual(calls.map(c=>c.input.year),[2025,2026,2027]);assert.ok(calls.every(c=>c.org==='org-a'&&c.input.months.length===12));assert.equal(paths[0],'/budget/liquidity');
});
test('tenant mismatch, missing selection and denied Employee produce zero writes',async()=>{
 for(const context of [{selectedOrganizationId:'org-b'},{selectedOrganizationId:null},Object.assign(new Error('forbidden'),{digest:'NEXT_HTTP_ERROR_FALLBACK;403'})]){
  const {action,calls}=fixture(context);assert.equal((await action(form())).code,'FORBIDDEN');assert.equal(calls.length,0);
 }
});
test('stale versions are exposed as conflicts without retry',async()=>{
 const {action,calls}=fixture(undefined,{code:'40001'});assert.equal((await action(form())).code,'CONFLICT');assert.equal(calls.length,1);
});

test('minimum balance is 30% of outflows rounded to cents, ignoring legacy targets',()=>{
 for(const [outflows,expected] of [[1000,300],[123.45,37.04],[0.05,0.02],[0.01,0],[0,0],[null,0]]){
  const values={...model.emptyLiquidity(),total_outflows:outflows,minimum_required_balance:999};
  assert.equal(model.deriveLiquidity(values).minimum_required_balance,expected);
  assert.equal(values.total_outflows,outflows);
 }
 assert.ok(!model.LIQUIDITY_INPUTS.includes('minimum_required_balance'));
});
test('save recomputes the RPC minimum target and ignores a tampered form value',async()=>{
 const f=form();f.set('total_outflows_1','123.45');f.set('minimum_required_balance_1','999999');
 const {action,calls}=fixture();assert.equal((await action(f)).ok,true);
 assert.equal(calls[0].input.months[0].minimum_required_balance,37.04);
 assert.equal(calls[0].input.months[1].minimum_required_balance,0);
 assert.equal(calls[0].input.months[1].total_outflows,null);
});
