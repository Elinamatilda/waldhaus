import 'server-only';
import { forbidden } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { getOrganizationContext } from '@/lib/organization-context';
import { createClient } from '@/lib/supabase/server';
import { budgetYear, type BudgetRow, type BudgetSubmission } from './model';

export async function requireBudgetContext() {
  await requireRole('admin');
  const context=await getOrganizationContext();
  if (!context.isSystemAdmin && context.role !== 'admin') forbidden();
  return context;
}
export async function loadAnnualBudget(organizationId:string,year:number):Promise<{ready:boolean;rows:BudgetRow[]}> {
  budgetYear(year);
  const supabase=await createClient();
  const {data,error}=await supabase.from('annual_budget_periods')
    .select('id,month_number,edit_version::text,sales_amount,raw_material_cost,energy_cost,labor_cost,maintenance_repairs_cost,transportation_logistics_cost,administration_sales_cost,waste_environmental_cost,production_m3')
    .eq('organization_id',organizationId).eq('year_number',year).order('month_number');
  if(error) {
    if(['42P01','PGRST205','42703','PGRST204'].includes(error.code)) return {ready:false,rows:[]};
    console.error('[budget][read]',error);
    throw new Error('Annual budget could not be loaded.');
  }
  return {ready:true,rows:(data??[]) as BudgetRow[]};
}
export async function persistAnnualBudget(organizationId:string,input:BudgetSubmission) {
  const supabase=await createClient();
  return supabase.rpc('save_annual_budget_year',{p_organization:organizationId,p_year:input.year,p_months:input.months});
}
