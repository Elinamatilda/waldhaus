'use server';
import { revalidatePath } from 'next/cache';
import { parseBudgetForm, type BudgetResult } from '@/lib/budget/model';
import { persistAnnualBudget, requireBudgetContext } from '@/lib/budget/service';

export async function saveAnnualBudgetAction(form:FormData):Promise<BudgetResult> {
  let context:Awaited<ReturnType<typeof requireBudgetContext>>;
  try {context=await requireBudgetContext();}
  catch(error) {
    if(error && typeof error==='object' && 'digest' in error) return {ok:false,code:'FORBIDDEN'};
    console.error('[budget][authorization]',error);return {ok:false,code:'DATABASE_ERROR'};
  }
  const organizationId=context.selectedOrganizationId;
  if(!organizationId || form.get('organization_id')!==organizationId) return {ok:false,code:'FORBIDDEN'};
  let input:ReturnType<typeof parseBudgetForm>;
  try {input=parseBudgetForm(form);} catch {return {ok:false,code:'INVALID_INPUT'};}
  try {
    const {error}=await persistAnnualBudget(organizationId,input);
    if(error) {
      console.error('[budget][save]',error);
      const code= ['40001','40P01','23505'].includes(error.code)?'CONFLICT':error.code==='42501'?'FORBIDDEN':
        ['22023','23514','22003'].includes(error.code)?'INVALID_INPUT': ['42883','PGRST202','42P01'].includes(error.code)?'UNAVAILABLE':'DATABASE_ERROR';
      return {ok:false,code};
    }
  } catch(error) {console.error('[budget][save]',error);return {ok:false,code:'DATABASE_ERROR'};}
  revalidatePath('/budget','layout');
  return {ok:true};
}
