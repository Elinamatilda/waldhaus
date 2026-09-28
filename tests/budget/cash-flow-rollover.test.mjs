import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {loadModule} from '../auth/load-module.mjs';
const model=loadModule('src/lib/budget/cash-flow-model.ts');
const yearRows=(year,opening=100)=>Array.from({length:12},(_,i)=>({
 ...model.emptyCashFlows(),id:`${year}-${i}`,year_number:year,month_number:i+1,edit_version:String(year*100+i),
 opening_balance:i===0?opening:null,sales_revenue:100,other_income:20,operating_costs:50,investments:30,loan_payments:10,
}));

test('2025 retains the saved opening; subsequent January comes from the preceding December',()=>{
 const history=[...yearRows(2025),...yearRows(2026,99999)];
 assert.deepEqual(model.resolveCashFlowOpening(2025,history),{openingBalance:100,missingYear:null});
 assert.equal(model.resolveCashFlowOpening(2026,history).openingBalance,460);
 assert.equal(model.resolveCashFlowOpening(2027,history).openingBalance,820);
 const calculated=model.calculateCashFlow(460,yearRows(2026));
 assert.equal(calculated.rows[0].closing_balance,490);assert.equal(calculated.rows[1].opening_balance,490);
 assert.equal(history.find(r=>r.year_number===2026&&r.month_number===1).opening_balance,99999);
 history[0].sales_revenue+=50;
 assert.equal(model.resolveCashFlowOpening(2027,history).openingBalance,870);
});
test('source gaps never silently become zero; negative and zero initial balances remain valid',()=>{
 assert.equal(model.resolveCashFlowOpening(2026,[]).missingYear,2025);
 assert.equal(model.resolveCashFlowOpening(2026,yearRows(2025).slice(0,11)).openingBalance,null);
 assert.equal(model.resolveCashFlowOpening(2027,yearRows(2025)).missingYear,2026);
 assert.equal(model.resolveCashFlowOpening(2024,yearRows(2025)).openingBalance,null);
 assert.equal(model.resolveCashFlowOpening(2025,yearRows(2025,0)).openingBalance,0);
 assert.equal(model.resolveCashFlowOpening(2026,yearRows(2025,-1000)).openingBalance,-640);
});

function serviceFixture(history){
 const requests=[];const writes=[];
 const client=createClient('https://example.invalid','test',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);requests.push(url);
  if(url.pathname.includes('/rpc/')){writes.push(JSON.parse(init.body));return Response.json({year:2026,months:[]});}
  assert.equal(url.searchParams.get('organization_id'),'eq.org-a');
  assert.ok(url.searchParams.get('select').includes('edit_version::text'));
  assert.deepEqual(url.searchParams.getAll('year_number').map(x=>x.split('.')[0]).sort(),['gte','lte']);
  const last=Number(url.searchParams.getAll('year_number').find(x=>x.startsWith('lte.')).slice(4));
  const offset=Number(url.searchParams.get('offset')??0);const limit=Number(url.searchParams.get('limit'));
  return Response.json(history.filter(row=>row.year_number>=2025&&row.year_number<=last).slice(offset,offset+limit));
 }}});
 const service=loadModule('src/lib/budget/cash-flow-service.ts',{'@/lib/supabase/server':{createClient:async()=>client}});
 return {service,requests,writes};
}
test('tenant-scoped history reads derive January even when the current year has not been saved',async()=>{
 const h=serviceFixture(yearRows(2025));const result=await h.service.loadCashFlowBudget('org-a',2026);
 assert.equal(result.ready,true);assert.equal(result.openingBalance,460);assert.deepEqual(result.rows,[]);
 assert.equal(h.writes.length,0);
});
test('history pagination retains all years, preserving lossless versions',async()=>{
 const history=Array.from({length:20},(_,i)=>yearRows(2025+i)).flat();history.at(-1).edit_version='9007199254740993';
 const h=serviceFixture(history);const result=await h.service.loadCashFlowBudget('org-a',2044);
 assert.equal(h.requests.length,2);assert.equal(result.openingBalance,100+19*360);
 assert.equal(result.rows.at(-1).edit_version,'9007199254740993');
});
test('server save rejects stale or forged opening balances and keeps the 2025 seed',async()=>{
 const h=serviceFixture([...yearRows(2025),...yearRows(2026,99999)]);
 const input={year:2026,opening:460,months:[]};
 assert.equal((await h.service.persistCashFlowBudget('org-a',{...input,opening:123})).error.code,'40001');
 assert.equal(h.writes.length,0);
 await h.service.persistCashFlowBudget('org-a',input);assert.equal(h.writes[0].p_opening_balance,460);
 assert.equal((await h.service.persistCashFlowBudget('org-a',{...input,year:2025,opening:999})).error.code,'40001');
 await h.service.persistCashFlowBudget('org-a',{...input,year:2025,opening:100});assert.equal(h.writes[1].p_opening_balance,100);
 const missing=serviceFixture([]);await missing.service.persistCashFlowBudget('org-a',input);assert.equal(missing.writes.length,0);
});
