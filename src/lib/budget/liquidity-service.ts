import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { budgetYear } from './model';
import type { LiquidityRow, LiquiditySubmission } from './liquidity-model';

export async function loadLiquidityForecast(organizationId:string,year:number):Promise<{ready:boolean;rows:LiquidityRow[]}> {
  budgetYear(year);
  const supabase=await createClient();
  const {data,error}=await supabase.from('liquidity_forecast_periods')
    .select('id,month_number,opening_balance,forecasted_sales,other_forecasted_income,total_outflows,edit_version::text')
    .eq('organization_id',organizationId).eq('year_number',year).order('month_number');
  if(error) {
    if(['42P01','PGRST205','42703','PGRST204'].includes(error.code))return {ready:false,rows:[]};
    console.error('[liquidity][read]',error);
    throw new Error('Liquidity forecast could not be loaded.');
  }
  return {ready:true,rows:(data??[]) as LiquidityRow[]};
}
export async function persistLiquidityForecast(organizationId:string,input:LiquiditySubmission) {
  const supabase=await createClient();
  return supabase.rpc('save_liquidity_forecast_year',{p_organization:organizationId,p_year:input.year,p_months:input.months});
}
