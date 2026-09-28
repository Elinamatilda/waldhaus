import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from '../auth/load-module.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const validation=loadModule('src/lib/sales/validation.ts');
function form() {
 const f=new FormData(); for(const key of ['organization_id','scenario_id','customer_id','product_id']) f.set(key,id);
 f.set('year','2026');
 for(let month=1;month<=12;month++) {
  for(const [key,value] of Object.entries({quantity:'2',volume:'',unit_price:'10',revenue:'999',quantity_unit:'PIECE',pricing_basis:'PER_PIECE',currency:'EUR',revenue_mode:'CALCULATED'})) f.set(`${key}_${month}`,value);
 }
 return f;
}
function actions(rpcError=null) {
 const calls=[];
 const api=loadModule('src/app/(authenticated)/sales/actions.ts',{
  '@/lib/auth/session':{requireRole:async()=>({profile:{is_system_admin:false},membership:{organization_id:id},user:{id}})},
  'next/cache':{revalidatePath:()=>{}},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:rpcError};}})},
 });
 return {api,calls};
}
test('numeric parsing distinguishes empty, valid and malformed values',()=>{
 assert.equal(validation.parseNumericInput('').state,'EMPTY');
 assert.equal(validation.parseNumericInput('1,25').value,1.25);
 for(const input of ['oops','NaN','Infinity','1e3','-2','0x12','1.2.3','1,000,000']) assert.equal(validation.parseNumericInput(input).state,'INVALID');
});
test('one invalid month results in zero persistence calls',async()=>{
 const {api,calls}=actions();const f=form();f.set('quantity_3','typo');
 assert.equal((await api.upsertPlanningGridAction(f)).code,'VALIDATION_ERROR');assert.equal(calls.length,0);
});
test('annual save sends twelve validated months to one RPC and ignores stale calculated revenue',async()=>{
 const {api,calls}=actions();assert.equal((await api.upsertPlanningGridAction(form())).ok,true);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'save_sales_year');assert.equal(calls[0].args.p_months.length,12);
 assert.equal(calls[0].args.p_months[0].revenue,null);
});
test('empty input preserves an existing fact; deletion requires explicit confirmation',()=>{
 const f=form();f.set('id_1',id);f.set('version_1','123');
 for(const name of ['quantity','volume','unit_price','revenue']) f.set(`${name}_1`,'');
 assert.equal(validation.parseAnnualForm(f).months[0].operation,'keep');
 f.set('delete_1','on');assert.throws(()=>validation.parseAnnualForm(f),/Confirm deletion/);
 f.set('confirm_delete','on');const rows=validation.parseAnnualForm(f).months;
 assert.equal(rows[0].operation,'delete');assert.ok(rows.slice(1).every(row=>row.operation==='save'));
});
test('partial input and dimension mismatch block writes',async()=>{
 for(const modify of [f=>f.set('quantity_2',''),f=>f.set('quantity_unit_2','LINEAR_METER'),f=>f.set('year','1999')]) {
  const f=form();modify(f);const {api,calls}=actions();assert.equal((await api.upsertPlanningGridAction(f)).code,'VALIDATION_ERROR');assert.equal(calls.length,0);
 }
});
test('stale database result is a structured conflict without retry',async()=>{
 const {api,calls}=actions({code:'40001',message:'Stale edit'});
 assert.equal((await api.upsertPlanningGridAction(form())).code,'CONFLICT');assert.equal(calls.length,1);
});
