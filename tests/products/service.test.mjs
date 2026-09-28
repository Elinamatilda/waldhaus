import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
const org='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const species={code:'oak',name_fi:'Tammi',name_pl:'Dąb',name_en:'Oak',scientific_name:null,is_active:true};
function fixture(context={role:'admin',isSystemAdmin:false,selectedOrganizationId:org},error=null){
 const calls=[];
 const service=loadModule('src/lib/products/service.ts',{
  '@/lib/auth/session':{requireRole:async role=>assert.equal(role,'admin')},
  '@/lib/organization-context':{getOrganizationContext:async()=>context},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{id,edit_version:'9007199254740993'},error};}})},
 });return {service,calls};
}
test('Admin and selected System Admin use authorized single RPC with lossless versions',async()=>{
 for(const isSystemAdmin of [false,true]){
  const {service,calls}=fixture({role:isSystemAdmin?'system_admin':'admin',isSystemAdmin,selectedOrganizationId:org});
  const saved=await service.saveProductMaster(org,'wood_species',null,null,species);
  assert.equal(saved.edit_version,'9007199254740993');assert.equal(calls.length,1);assert.equal(calls[0].args.p_organization,org);
 }
});
test('Employee, other tenant and missing System Admin selection cause zero writes',async()=>{
 for(const context of [{role:'employee',isSystemAdmin:false,selectedOrganizationId:org},{role:'admin',isSystemAdmin:false,selectedOrganizationId:id},{role:'system_admin',isSystemAdmin:true,selectedOrganizationId:null}]){
  const {service,calls}=fixture(context);await assert.rejects(service.saveProductMaster(org,'wood_species',null,null,species));assert.equal(calls.length,0);
 }
});
test('malformed complete payload and stale tokens reject without silent coercion or retry',async()=>{
 const {service,calls}=fixture();await assert.rejects(service.saveProductMaster(org,'wood_species',null,null,{...species,code:'Oak'}));assert.equal(calls.length,0);
 const stale=fixture(undefined,{code:'40001'});await assert.rejects(stale.service.saveProductMaster(org,'wood_species',id,'1',species),e=>e.databaseCode==='40001');assert.equal(stale.calls.length,1);
});
