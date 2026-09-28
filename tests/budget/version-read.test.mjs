import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {loadModule} from '../auth/load-module.mjs';
test('bigint read is explicitly text transport with no JavaScript integer rounding',async()=>{
 const client=createClient('https://example.invalid','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{
  const url=new URL(input);assert.ok(url.searchParams.get('select').includes('edit_version::text'));
  return Response.json([{month_number:1,edit_version:'9007199254740993',sales_amount:null,energy_cost:0}]);
 }}});
 const api=loadModule('src/lib/budget/service.ts',{
  '@/lib/supabase/server':{createClient:async()=>client},'@/lib/auth/session':{},'@/lib/organization-context':{},'next/navigation':{},
 });
 const result=await api.loadAnnualBudget('org',2026);
 assert.equal(result.rows[0].edit_version,'9007199254740993');assert.equal(result.rows[0].sales_amount,null);assert.equal(result.rows[0].energy_cost,0);
});
