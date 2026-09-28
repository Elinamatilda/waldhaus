import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from '../auth/load-module.mjs';
for(const entity of ['customers','products']) {
 test(`empty ${entity} and zero search matches keep creation manager available`,async()=>{
  const Manager=()=>null;
  const page=loadModule(`src/app/(authenticated)/sales/${entity}/page.tsx`,{
   'next/link':()=>null,
   '@/lib/auth/session':{requireRole:async()=>{}},
   '@/components/ui':{EmptyState:()=>null,PageHeader:()=>null,Card:()=>null},
   '@/components/sales/customer-analysis-view':{CustomerAnalysisView:()=>null},
   '@/components/sales/customer-analysis-filters':{CustomerAnalysisFilterBar:()=>null},
   '@/lib/sales/customer-analysis-service':{loadCustomerAnalysis:async()=>({kind:'ready',scope:{organizationId:'org',isSystemAdmin:true,organizations:[]},filters:{year:2026,scenario:'BUDGET',currency:'EUR'},data:null,error:'unavailable',customers:[]})},
   [`@/components/sales/${entity}-manager`]:{[entity==='customers'?'CustomersManager':'ProductsManager']:Manager},
   '@/lib/i18n/locale':{getRequestLocale:async()=> 'fi'},
   '@/lib/sales/scope':{resolveSalesScope:async()=>({organizationId:'org',isSystemAdmin:true})},
   '@/lib/sales/service':{assertSalesSchemaReady:async()=>({ready:true}),[entity==='customers'?'listCustomers':'listProducts']:async()=>[]},
  }).default;
  for(const q of ['', 'no matches']) {
   const tree=await page({searchParams:Promise.resolve({q})});
   function find(node){if(!node || typeof node!=='object')return false;if(node.type===Manager)return true;const children=node.props?.children;return (Array.isArray(children)?children:[children]).some(find);}
   assert.equal(find(tree),true);
  }
 });
}
