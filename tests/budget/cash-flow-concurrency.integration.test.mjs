import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {loadModule} from '../auth/load-module.mjs';

// Opt-in only: writes a previously empty year in an approved disposable project.
// Never reads .env.local. No migration/reset/DDL is performed. Keep JWT out of output.
const enabled=process.env.RUN_DISPOSABLE_CASH_FLOW_TEST==='1';
test('two independent concurrent saves: one complete winner and one 40001 conflict', {skip:!enabled}, async()=>{
 const {CASH_FLOW_INPUTS}=loadModule('src/lib/budget/cash-flow-model.ts');
 const organization=process.env.BUDGET_TEST_ORGANIZATION;
 const year=Number(process.env.BUDGET_TEST_YEAR);
 assert.ok(organization&&Number.isInteger(year)&&year>=2020&&year<=2100);
 const makeClient=()=>createClient(process.env.BUDGET_TEST_URL,process.env.BUDGET_TEST_ANON_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${process.env.BUDGET_TEST_ADMIN_JWT}`}},
 });
 const first=makeClient();const second=makeClient();
 const read=()=>first.from('cash_flow_budget_periods').select('month_number,edit_version::text,sales_revenue,other_income')
  .eq('organization_id',organization).eq('year_number',year).order('month_number');
 const before=await read();assert.equal(before.error,null);assert.equal(before.data.length,0,'Use a new empty test year');
 const payload=value=>({p_organization:organization,p_year:year,p_opening_balance:-100,p_months:Array.from({length:12},(_,i)=>({
  ...Object.fromEntries(CASH_FLOW_INPUTS.map(field=>[field,null])),month_number:i+1,expected_version:null,sales_revenue:value,other_income:0,
 }))});
 const results=await Promise.all([first.rpc('save_cash_flow_budget_year',payload(111)),second.rpc('save_cash_flow_budget_year',payload(222))]);
 assert.equal(results.filter(result=>!result.error).length,1);
 assert.equal(results.find(result=>result.error)?.error.code,'40001');
 const after=await read();assert.equal(after.error,null);assert.equal(after.data.length,12);
 const expected=results[0].error?222:111;
 assert.ok(after.data.every(row=>row.sales_revenue===expected&&row.other_income===0));
});
