import { EmptyState, PageHeader } from '@/components/ui';
import { LiquidityEditor } from '@/components/budget/liquidity-editor';
import { BudgetYearSelector } from '@/components/budget/year-selector';
import { requireBudgetContext } from '@/lib/budget/service';
import { loadLiquidityForecast } from '@/lib/budget/liquidity-service';
import { budgetYear } from '@/lib/budget/model';
import { getRequestLocale } from '@/lib/i18n/locale';
import { tApp } from '@/lib/i18n/app-ui';

export default async function LiquidityPage({searchParams}:{searchParams?:Promise<{year?:string}>}) {
  const [context,locale,params]=await Promise.all([requireBudgetContext(),getRequestLocale(),searchParams]);
  const currentYear=new Date().getUTCFullYear();
  let year=currentYear;let invalid=false;
  try{year=budgetYear(params?.year??currentYear);}catch{invalid=true;}
  const header=<PageHeader eyebrow={tApp(locale,'nav.budget')} title={tApp(locale,'nav.liquidityForecast')} description={tApp(locale,'liquidity.distinction')} />;
  if(!context.selectedOrganizationId)return <div className="space-y-6">{header}<EmptyState title={tApp(locale,'org.select')} description={tApp(locale,'org.switch')} /></div>;
  if(invalid)return <div className="space-y-6">{header}<BudgetYearSelector year={currentYear} locale={locale} /><EmptyState title={tApp(locale,'budget.invalidYear')} description={tApp(locale,'budget.changeYear')} /></div>;
  const budget=await loadLiquidityForecast(context.selectedOrganizationId,year);
  return <div className="space-y-6">{header}<BudgetYearSelector year={year} locale={locale} />
    {budget.ready?<LiquidityEditor key={`${context.selectedOrganizationId}:${year}:${budget.rows.map(row=>row.edit_version).join(',')}`} organizationId={context.selectedOrganizationId} year={year} locale={locale} rows={budget.rows} />:<EmptyState title={tApp(locale,'liquidity.unavailable')} description={tApp(locale,'budget.importPending')} />}
  </div>;
}
