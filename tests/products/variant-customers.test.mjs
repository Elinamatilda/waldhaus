import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from '../auth/load-module.mjs';
const org='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',customer='33333333-3333-4333-8333-333333333333',linkId='44444444-4444-4444-8444-444444444444';
const data={product_id:id,variant_code:'THRESHOLD-130',variant_name:'Threshold',wood_species_id:null,construction_type_id:null,quality_code:null,thickness_mm:'27',width_mm:'130',length_mm:'3000',default_quantity_unit_code:'PIECE',is_active:true};
function fixture(context={role:'admin',isSystemAdmin:false,selectedOrganizationId:org},error=null){
 const calls=[];
 const service=loadModule('src/lib/products/service.ts',{
  '@/lib/auth/session':{requireRole:async()=>{}},
  '@/lib/organization-context':{getOrganizationContext:async()=>context},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{id,edit_version:'9007199254740993'},error};}})},
 });return {service,calls};
}
test('variant and selected customers use one atomic RPC with separate payloads',async()=>{
 const {service,calls}=fixture();
 assert.equal((await service.saveProductVariantCustomers(org,null,null,data,[],[customer],false)).id,id);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'save_product_variant_customers');
 assert.deepEqual(calls[0].args.p_customer_ids,[customer]);assert.deepEqual(calls[0].args.p_data,data);
 assert.ok(!Object.hasOwn(calls[0].args.p_data,'customer_id'));
});
test('editing preserves variant and relationship versions without numeric conversion',async()=>{
 const {service,calls}=fixture();
 const expected=[{id:linkId,edit_version:'9007199254740993'}];
 await service.saveProductVariantCustomers(org,id,'9007199254740994',data,expected,[],true);
 assert.deepEqual(calls[0].args.p_expected_links,expected);
 assert.equal(calls[0].args.p_expected_version,'9007199254740994');assert.equal(calls[0].args.p_confirm_archive,true);
});
test('unauthorized and malformed input cannot write',async()=>{
 for(const context of [{role:'employee',isSystemAdmin:false,selectedOrganizationId:org},{role:'admin',isSystemAdmin:false,selectedOrganizationId:id},{role:'system_admin',isSystemAdmin:true,selectedOrganizationId:null}]){
  const {service,calls}=fixture(context);await assert.rejects(service.saveProductVariantCustomers(org,null,null,data,[],[customer],false));assert.equal(calls.length,0);
 }
 for(const [expected,customers] of [[[],[customer,customer]],[[{id:linkId,edit_version:9}],[]],[[{id:linkId,edit_version:'1',unknown:'x'}],[]],[[],['invalid']],[[{id:linkId,edit_version:'1'}],[]]]){
  const {service,calls}=fixture();await assert.rejects(service.saveProductVariantCustomers(org,null,null,data,expected,customers,false));assert.equal(calls.length,0);
 }
});
test('stale relation or missing migration fails without retry or partial fallback',async()=>{
 for(const code of ['40001','PGRST202']){
  const {service,calls}=fixture(undefined,{code});
  await assert.rejects(service.saveProductVariantCustomers(org,id,'1',data,[],[customer],false),error=>error.databaseCode===code);assert.equal(calls.length,1);
 }
});
test('action reads customer choices separately and never sends them in physical payload',async()=>{
 const calls=[];
 const action=loadModule('src/app/actions/product-master.ts',{
  'next/cache':{revalidatePath(){}},'@/lib/i18n/locale':{getRequestLocale:async()=> 'fi'},
  '@/lib/products/service':{saveProductVariantCustomers:async(...args)=>{calls.push(args);return {id,edit_version:'1'};},saveProductMaster:async()=>{throw Error('Wrong writer');}},
 }).saveProductMasterAction;
 const form=new FormData();for(const [key,value] of Object.entries(data))form.set(key,value===null?'':String(value));
 form.set('entity','product_variants');form.set('organization_id',org);form.set('customer_selection_present','true');form.set('expected_customer_links','[]');form.append('customer_ids',customer);
 assert.deepEqual(await action(form),{ok:true,id});assert.deepEqual(calls[0][5],[customer]);assert.deepEqual(calls[0][3],data);
 form.set('expected_customer_links','invalid');assert.equal((await action(form)).ok,false);assert.equal(calls.length,1);
});
test('edit popup prefills customers, submits snapshots and confirms removal',()=>{
 const existing={id:linkId,edit_version:'9007199254740993',customer_id:customer,is_active:true,customer:{id:customer,name:'Customer Oy',is_active:true}};
 const variant={...data,id,edit_version:'2',dimensions:{thickness_mm:'27',width_mm:'130',length_mm:'3000'},related:{customer_products:[existing]}};
 for(const selected of [[customer],[]]){
  const editor={entity:'product_variants',row:variant,customerLinks:[existing]};
  const Manager=loadModule('src/components/sales/product-master-manager.tsx',{
   react:{...React,useTransition:()=>[false,()=>{}],useState:initial=>[initial===null?editor:Array.isArray(initial)?selected:initial,()=>{}]},
   'next/navigation':{useRouter:()=>({refresh(){}})},'next/link':({children,...props})=>React.createElement('a',props,children),
   './product-species-selector':{ProductSpeciesSelector:()=>null},
   '@/app/actions/product-master':{saveProductMasterAction:async()=>({ok:true})},
  }).ProductMasterManager;
  const html=renderToStaticMarkup(React.createElement(Manager,{organizationId:org,locale:'fi',definition:{product:{id,name:'Kynnykset',is_active:true},variants:[variant]},lookups:{wood_species:[],construction_types:[]},customers:[{id:customer,name:'Customer Oy',is_active:true}]}));
  assert.ok(html.includes('name="expected_customer_links"'));assert.ok(html.includes('9007199254740993'));assert.ok(html.includes('Customer Oy'));
  assert.equal(html.includes('name="confirm_customer_archive"'),selected.length===0);
  assert.equal(html.includes('name="customer_ids"'),selected.length>0);
  assert.ok(!html.includes('name="customer_id"'));
 }
});
