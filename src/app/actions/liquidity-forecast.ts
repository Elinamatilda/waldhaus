'use server';
import { revalidatePath } from 'next/cache';
import { requireBudgetContext } from '@/lib/budget/service';
import { parseLiquidityForm } from '@/lib/budget/liquidity-model';
import { budgetSaved, type BudgetSaved } from '@/lib/budget/saved-versions';
import { persistLiquidityForecast } from '@/lib/budget/liquidity-service';
import type { BudgetResult } from '@/lib/budget/model';

export async function saveLiquidityForecastAction(form:FormData):Promise<Exclude<BudgetResult,{ok:true}>|{ok:true;saved:BudgetSaved}> {
  let context:Awaited<ReturnType<typeof requireBudgetContext>>;
  try {context=await requireBudgetContext();}
  catch(error) {
    if(error&&typeof error==='object'&&'digest' in error)return {ok:false,code:'FORBIDDEN'};
    console.error('[liquidity][authorization]',error);return {ok:false,code:'DATABASE_ERROR'};
  }
  const organizationId=context.selectedOrganizationId;
  if(!organizationId||form.get('organization_id')!==organizationId)return {ok:false,code:'FORBIDDEN'};
  let input:ReturnType<typeof parseLiquidityForm>;
  try {input=parseLiquidityForm(form);}catch{return {ok:false,code:'INVALID_INPUT'};}
  let saved:BudgetSaved;
  try {
    const {data,error}=await persistLiquidityForecast(organizationId,input);
    if(error) {
      console.error('[liquidity][save]',error);
      const code=['40001','40P01','23505'].includes(error.code)?'CONFLICT':error.code==='42501'?'FORBIDDEN':
        ['22023','23514','22003'].includes(error.code)?'INVALID_INPUT':['42883','PGRST202','42P01'].includes(error.code)?'UNAVAILABLE':'DATABASE_ERROR';
      return {ok:false,code};
    }
    saved=budgetSaved(data,input.year);
  }catch(error){console.error('[liquidity][save]',error);return {ok:false,code:'DATABASE_ERROR'};}
  revalidatePath('/budget/liquidity');
  return {ok:true,saved};
}
