import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
const org='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';

test('top-level creation returns the saved id for navigation and writes only product fields',async()=>{
 const writes=[],paths=[];
 const actions=loadModule('src/app/(authenticated)/sales/actions.ts',{
  '@/lib/auth/session':{requireRole:async()=>({profile:{is_system_admin:false},membership:{organization_id:org},user:{id}})},
  'next/cache':{revalidatePath:path=>paths.push(path)},
  '@/lib/supabase/server':{createClient:async()=>({from:table=>{assert.equal(table,'products');return {insert:payload=>{writes.push(payload);return {select:projection=>{assert.equal(projection,'id');return {single:async()=>({data:{id},error:null})};}};}};}})},
 });
 const form=new FormData();for(const [key,value] of Object.entries({name:'Thresholds',product_code:'THRESHOLD',description:'Wooden thresholds',organization_id:org,customer_id:id,price:'10'}))form.set(key,value);
 assert.deepEqual(await actions.createProductAction(form),{ok:true,id});
 assert.equal(writes.length,1);assert.equal(writes[0].organization_id,org);
 assert.ok(!Object.hasOwn(writes[0],'customer_id'));assert.ok(!Object.hasOwn(writes[0],'price'));
 assert.ok(paths.includes('/sales/products'));
});
test('canonical archive requires explicit confirmation and keeps optimistic version unchanged',async()=>{
 const calls=[],paths=[];
 const actions=loadModule('src/app/actions/product-master.ts',{
  '@/lib/i18n/locale':{getRequestLocale:async()=> 'fi'},
  'next/cache':{revalidatePath:path=>paths.push(path)},
  '@/lib/products/service':{archiveProductMaster:async(...args)=>calls.push(args)},
 });
 const form=new FormData();for(const [key,value] of Object.entries({entity:'product_variants',organization_id:org,id,edit_version:'9007199254740993',operation:'archive'}))form.set(key,value);
 assert.equal((await actions.saveProductMasterAction(form)).ok,false);assert.equal(calls.length,0);
 form.set('confirmed','true');assert.equal((await actions.saveProductMasterAction(form)).ok,true);
 assert.deepEqual(calls,[[org,'product_variants',id,'9007199254740993']]);
 assert.ok(paths.includes('/sales/actuals'));assert.ok(paths.includes('/budget/sales'));
});
