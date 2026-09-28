import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from '../auth/load-module.mjs';
const org='11111111-1111-4111-8111-111111111111',product='22222222-2222-4222-8222-222222222222';
const oak='33333333-3333-4333-8333-333333333333',birch='44444444-4444-4444-8444-444444444444';
function fixture(context={role:'admin',isSystemAdmin:false,selectedOrganizationId:org},error=null){
 const calls=[];
 const service=loadModule('src/lib/products/service.ts',{
  '@/lib/auth/session':{requireRole:async()=>{}},
  '@/lib/organization-context':{getOrganizationContext:async()=>context},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {error};}})},
 });return {service,calls};
}
test('selection makes one product association RPC, never variant or lookup writes',async()=>{
 const {service,calls}=fixture();
 await service.saveProductWoodSpecies(org,product,[oak],[birch,oak]);
 assert.deepEqual(calls,[{name:'save_product_wood_species',args:{p_organization:org,p_product:product,p_expected:[oak],p_selected:[oak,birch]}}]);
 await service.saveProductWoodSpecies(org,product,[oak,birch],[]);
 assert.deepEqual(calls[1].args.p_selected,[]);
});
test('forbidden organization/employee and malformed selections cause zero writes',async()=>{
 for(const context of [{role:'employee',isSystemAdmin:false,selectedOrganizationId:org},{role:'admin',isSystemAdmin:false,selectedOrganizationId:product},{role:'system_admin',isSystemAdmin:true,selectedOrganizationId:null}]){
  const {service,calls}=fixture(context);await assert.rejects(service.saveProductWoodSpecies(org,product,[],[oak]));assert.equal(calls.length,0);
 }
 for(const selected of [[oak,oak],['Tammi'],[null],Array(101).fill(oak)]){
  const {service,calls}=fixture();await assert.rejects(service.saveProductWoodSpecies(org,product,[],selected));assert.equal(calls.length,0);
 }
});
test('stale selection surfaces as a conflict without retry',async()=>{
 const {service,calls}=fixture(undefined,{code:'40001'});
 await assert.rejects(service.saveProductWoodSpecies(org,product,[],[oak]),e=>e.databaseCode==='40001');assert.equal(calls.length,1);
});
test('action reads all checked IDs and preserves expected selection; clearing all is explicit',async()=>{
 const calls=[];
 const action=loadModule('src/app/actions/product-master.ts',{
  'next/cache':{revalidatePath(){}},'@/lib/i18n/locale':{getRequestLocale:async()=> 'fi'},
  '@/lib/products/service':{saveProductWoodSpecies:async(...args)=>calls.push(args)},
 }).saveProductWoodSpeciesAction;
 const form=new FormData();form.set('organization_id',org);form.set('product_id',product);
 assert.equal((await action(form)).ok,false);assert.equal(calls.length,0);
 form.set('selection_present','true');form.append('expected_species_ids',oak);form.append('wood_species_ids',oak);form.append('wood_species_ids',birch);
 assert.equal((await action(form)).ok,true);assert.deepEqual(calls[0],[org,product,[oak],[oak,birch]]);
 form.delete('wood_species_ids');assert.equal((await action(form)).ok,true);assert.deepEqual(calls[1][3],[]);
});
test('product popup presents existing species choices without canonical-code/name creation fields',()=>{
 const editing={expected:[oak],selected:[oak,birch]};
 const Selector=loadModule('src/components/sales/product-species-selector.tsx',{
  react:{...React,useState:initial=>[initial===null?editing:initial,()=>{}],useTransition:()=>[false,()=>{}]},
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/app/actions/product-master':{saveProductWoodSpeciesAction:async()=>({ok:true})},
 }).ProductSpeciesSelector;
 const html=renderToStaticMarkup(React.createElement(Selector,{organizationId:org,productId:product,productName:'Kynnykset',productActive:true,locale:'fi',options:[{id:oak,name:'Tammi',is_active:true},{id:birch,name:'Koivu',is_active:true}],selected:[{id:oak,name:'Tammi',is_active:true}]}));
 assert.ok(html.includes('Tammi, Koivu'));assert.ok(html.includes('name="wood_species_ids" value="'+oak+'"'));assert.ok(html.includes('name="wood_species_ids" value="'+birch+'"'));
 for(const field of ['code','name_fi','name_pl','name_en','variant_code','variant_name'])assert.ok(!html.includes('name="'+field+'"'));
 assert.ok(html.includes('Valinta ei luo variantteja'));
});
test('shared dropdown exposes independent native checkboxes and keeps selected ids when closed',()=>{
 for(const open of [false,true]){
  const Select=loadModule('src/components/ui/multi-checkbox-select.tsx',{
   react:{...React,useState:()=>[open,()=>{}]},
  }).MultiCheckboxSelect;
  const html=renderToStaticMarkup(React.createElement(Select,{name:'wood_species_ids',label:'Puulajit',placeholder:'Valitse',emptyLabel:'Tyhjä',options:[{id:oak,name:'Tammi'},{id:birch,name:'Koivu'}],value:[oak,birch],onChange(){}}));
  assert.equal((html.match(/type="hidden"/g)??[]).length,2);
  assert.equal((html.match(/type="checkbox"/g)??[]).length,open?2:0);
  assert.ok(html.includes(`aria-expanded="${open}"`));
 }
});
