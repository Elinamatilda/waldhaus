import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {loadModule} from '../auth/load-module.mjs';
const org='11111111-1111-4111-8111-111111111111';
const product='22222222-2222-4222-8222-222222222222';
const customer='33333333-3333-4333-8333-333333333333';
function fixture({missing=false,forbidden=false}={}){
 const requests=[];
 const client=createClient('https://example.invalid','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{
  const url=new URL(input);requests.push(url);
  assert.equal(url.searchParams.get('organization_id'),`eq.${org}`);
  const table=url.pathname.split('/').at(-1);
  if(table==='wood_species')return missing?Response.json({code:'PGRST205',message:'Missing table'},{status:404}):Response.json([]);
  if(table==='customer_products'){
   assert.equal(url.searchParams.get('customer_id'),`eq.${customer}`);
   return Response.json([{id:'r1',product_variant_id:'linked',is_active:true},{id:'r2',product_variant_id:'inactive-variant',is_active:true},{id:'r3',product_variant_id:'archived-link',is_active:false}]);
  }
  assert.equal(table,'product_variants');assert.equal(url.searchParams.get('product_id'),`eq.${product}`);
  assert.ok(!url.searchParams.get('select').includes('customer_id'));assert.ok(!url.searchParams.has('customer_id'));
  return Response.json([{id:'linked',is_active:true},{id:'inactive-variant',is_active:false},{id:'archived-link',is_active:true},{id:'unlinked',is_active:true}]);
 }}});
 const service=loadModule('src/lib/products/service.ts',{
  '@/lib/auth/session':{requireRole:async()=>{if(forbidden)throw Error('Forbidden');}},
  '@/lib/organization-context':{getOrganizationContext:async()=>({role:'admin',isSystemAdmin:false,selectedOrganizationId:org})},
  '@/lib/supabase/server':{createClient:async()=>client},
 });
 return {service,requests};
}
test('customer choices use active commercial links and active product variants with tenant scope',async()=>{
 const {service,requests}=fixture();
 assert.deepEqual((await service.listCustomerProductVariants(org,product,customer)).map(row=>row.id),['linked']);
 assert.equal(requests.length,3);
});
test('pre-migration rollout offers no invented customer links and does not read legacy variant coupling',async()=>{
 const {service,requests}=fixture({missing:true});assert.deepEqual(await service.listCustomerProductVariants(org,product,customer),[]);assert.equal(requests.length,1);
});
test('unauthorized customer choices stop before any database access',async()=>{
 const {service,requests}=fixture({forbidden:true});await assert.rejects(service.listCustomerProductVariants(org,product,customer));assert.equal(requests.length,0);
});
