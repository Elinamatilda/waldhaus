import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
import {annualForm} from './fixture.mjs';
function fixture(context={selectedOrganizationId:'org-a'},error=null) {
 const calls=[];const paths=[];
 const action=loadModule('src/app/actions/annual-budget.ts',{
  'next/cache':{revalidatePath:(...args)=>paths.push(args)},
  '@/lib/budget/service':{requireBudgetContext:async()=>context,persistAnnualBudget:async(org,input)=>{calls.push({org,input});return {error};}},
 }).saveAnnualBudgetAction;
 return {action,calls,paths};
}
test('malformed last month causes zero writes',async()=>{
 const f=annualForm();f.set('labor_cost_12','mistake');const {action,calls}=fixture();
 assert.deepEqual(await action(f),{ok:false,code:'INVALID_INPUT'});assert.equal(calls.length,0);
});
test('one validated 12-month operation uses selected organization and revalidates Budget',async()=>{
 const {action,calls,paths}=fixture();assert.deepEqual(await action(annualForm()),{ok:true});
 assert.equal(calls.length,1);assert.equal(calls[0].org,'org-a');assert.equal(calls[0].input.months.length,12);
 assert.deepEqual(paths,[['/budget','layout']]);
});
test('cross-organization or missing selection cannot write',async()=>{
 for(const selectedOrganizationId of ['org-b',null]) {
  const {action,calls}=fixture({selectedOrganizationId});assert.equal((await action(annualForm())).code,'FORBIDDEN');assert.equal(calls.length,0);
 }
});
test('stale version gives conflict without automatic retry',async()=>{
 const {action,calls}=fixture(undefined,{code:'40001'});assert.equal((await action(annualForm())).code,'CONFLICT');assert.equal(calls.length,1);
});
test('budget access requires organization admin or System Admin, Employee denied',async()=>{
 for(const role of ['employee','admin','system_admin']) {
  const api=loadModule('src/lib/budget/service.ts',{
   'next/navigation':{forbidden:()=>{throw Error('forbidden');}},
   '@/lib/auth/session':{requireRole:async()=>{}},
   '@/lib/organization-context':{getOrganizationContext:async()=>({role,isSystemAdmin:role==='system_admin',selectedOrganizationId:'org-a'})},
   '@/lib/supabase/server':{},
  });
  if(role==='employee')await assert.rejects(api.requireBudgetContext(),/forbidden/);
  else assert.equal((await api.requireBudgetContext()).selectedOrganizationId,'org-a');
 }
});

test('save payload preserves blank NULL and explicit zero without coercion',async()=>{
 const form=annualForm();form.set('sales_amount_1','');form.set('sales_amount_2','0');
 const {action,calls}=fixture();assert.equal((await action(form)).ok,true);
 assert.equal(calls[0].input.months[0].sales_amount,null);
 assert.equal(calls[0].input.months[1].sales_amount,0);
});
