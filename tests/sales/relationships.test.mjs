import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { loadModule } from '../auth/load-module.mjs';

test('planning read uses tenant-scoped FK and never creates missing periods',async () => {
  const requests=[];
  const client=createClient('https://example.invalid','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async (input,init) => {
    const url=new URL(input); requests.push(url); assert.equal(init.method,'GET');
    assert.equal(url.searchParams.get('organization_id'),'eq.org-test');
    if (url.pathname.endsWith('sales_periods')) return Response.json([]);
    assert.match(url.searchParams.get('select'),/sales_periods!sales_facts_same_org_period_fk\(month_number\)/);
    return Response.json([]);
  }}});
  const api=loadModule('src/lib/sales/service.ts',{'@/lib/supabase/server':{createClient:async()=>client}});
  assert.deepEqual(await api.loadPlanningGridRows('org-test',{year:2026,scenarioId:'scenario',variantId:''}),[]);
  assert.ok(requests.length<=2);
});
for (const method of ['getOverviewData','getCustomerSalesAnalytics','getProductSalesAnalytics']) {
  test(`${method} uses database aggregation with explicit organization/year/entity scope`,async()=>{
    const report={totals:[{scenario:'ACTUAL',currency_code:'PLN',revenue:1001,volume:2}],months:[],prices:[],customers:[],products:[]};
    let calls=0;
    const api=loadModule('src/lib/sales/service.ts',{'@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{
      calls++;assert.equal(name,'sales_report');assert.equal(args.p_organization,'org');assert.equal(args.p_year,2026);
      assert.equal(args.p_customer,method==='getCustomerSalesAnalytics'?'entity':null);
      assert.equal(args.p_product,method==='getProductSalesAnalytics'?'entity':null);
      return {data:report,error:null};
    }})}});
    const result=method==='getOverviewData'?await api[method]('org',2026):await api[method]('org','entity',2026);
    assert.deepEqual(result,report);assert.equal(calls,1);
  });
}
