import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { budgetYear } from './model';
import { CASH_FLOW_START_YEAR, resolveCashFlowOpening, type CashFlowHistoryRow, type CashFlowSubmission } from './cash-flow-model';

export async function loadCashFlowBudget(organizationId:string,year:number) {
  budgetYear(year);
  const supabase=await createClient();
  const history:CashFlowHistoryRow[]=[];
  for(let page=0;;page++){
    const {data,error}=await supabase.from('cash_flow_budget_periods')
      .select('id,year_number,month_number,opening_balance,sales_revenue,other_income,operating_costs,investments,loan_payments,edit_version::text')
      .eq('organization_id',organizationId).gte('year_number',CASH_FLOW_START_YEAR).lte('year_number',year)
      .order('year_number').order('month_number').range(page*200,page*200+199);
    if(error) {
      if(['42P01','PGRST205','42703','PGRST204'].includes(error.code))return {ready:false,rows:[],openingBalance:null,missingYear:null};
      console.error('[cash-flow][read]',error);
      throw new Error('Cash flow budget could not be loaded.');
    }
    history.push(...(data??[]) as CashFlowHistoryRow[]);
    if(!data||data.length<200)break;
  }
  return {ready:true,rows:history.filter(row=>row.year_number===year),...resolveCashFlowOpening(year,history)};
}
export async function persistCashFlowBudget(organizationId:string,input:CashFlowSubmission) {
  // Recheck the saved source after authorization and before every save. A stale
  // browser value cannot replace the initial seed or an inherited opening.
  const source=await loadCashFlowBudget(organizationId,input.year);
  if(!source.ready||source.openingBalance===null)return {data:null,error:{code:'42P01'}};
  if(source.openingBalance!==input.opening)return {data:null,error:{code:'40001'}};
  const supabase=await createClient();
  return supabase.rpc('save_cash_flow_budget_year',{p_organization:organizationId,p_year:input.year,p_opening_balance:source.openingBalance,p_months:input.months});
}
