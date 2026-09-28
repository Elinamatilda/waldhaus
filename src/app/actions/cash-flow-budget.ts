'use server';
import { revalidatePath } from 'next/cache';
import { requireBudgetContext } from '@/lib/budget/service';
import { cashFlowSaved, parseCashFlowForm, type CashFlowSaved } from '@/lib/budget/cash-flow-model';
import { persistCashFlowBudget } from '@/lib/budget/cash-flow-service';
import type { BudgetResult } from '@/lib/budget/model';

export async function saveCashFlowBudgetAction(form:FormData):Promise<Exclude<BudgetResult,{ok:true}>|{ok:true;saved:CashFlowSaved}> {
  let context:Awaited<ReturnType<typeof requireBudgetContext>>;
  try {context=await requireBudgetContext();}
  catch(error) {
    if(error&&typeof error==='object'&&'digest' in error)return {ok:false,code:'FORBIDDEN'};
    console.error('[cash-flow][authorization]',error);return {ok:false,code:'DATABASE_ERROR'};
  }
  const organizationId=context.selectedOrganizationId;
  if(!organizationId||form.get('organization_id')!==organizationId)return {ok:false,code:'FORBIDDEN'};
  let input:ReturnType<typeof parseCashFlowForm>;
  try {input=parseCashFlowForm(form);}catch{return {ok:false,code:'INVALID_INPUT'};}
  let saved:CashFlowSaved;
  try {
    const {data,error}=await persistCashFlowBudget(organizationId,input);
    if(error) {
      console.error('[cash-flow][save]',error);
      const code=['40001','40P01','23505'].includes(error.code)?'CONFLICT':error.code==='42501'?'FORBIDDEN':
        ['22023','23514','22003'].includes(error.code)?'INVALID_INPUT':['42883','PGRST202','42P01'].includes(error.code)?'UNAVAILABLE':'DATABASE_ERROR';
      return {ok:false,code};
    }
    saved=cashFlowSaved(data,input.year);
  }catch(error){console.error('[cash-flow][save]',error);return {ok:false,code:'DATABASE_ERROR'};}
  revalidatePath('/budget/cash-flow');
  return {ok:true,saved};
}
