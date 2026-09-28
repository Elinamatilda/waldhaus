import { EmptyState, MetricCard, PageHeader } from '@/components/ui';
import { getRequestLocale } from '@/lib/i18n/locale';
import { tApp } from '@/lib/i18n/app-ui';
import { budgetYear, deriveBudget, totalBudget } from '@/lib/budget/model';
import { loadAnnualBudget, requireBudgetContext } from '@/lib/budget/service';
import { AnnualBudgetEditor } from './annual-editor';
import { BudgetYearSelector } from './year-selector';

export async function BudgetScreen({searchParams,overview=false}:{searchParams?:Promise<{year?:string}>;overview?:boolean}) {
  const [locale,context,params]=await Promise.all([getRequestLocale(),requireBudgetContext(),searchParams]);
  const currentYear=new Date().getUTCFullYear();
  let year=currentYear;
  let invalidYear=false;
  try {year=budgetYear(params?.year??currentYear);} catch {invalidYear=true;}
  const heading=tApp(locale,overview?'nav.budgetOverview':'nav.annualBudget');
  const header=<PageHeader eyebrow={tApp(locale,'nav.budget')} title={heading} description={`${tApp(locale,'budget.year')}: ${invalidYear?'—':year}`} />;
  if(!context.selectedOrganizationId) return <div className="space-y-6">{header}<EmptyState title={tApp(locale,'org.select')} description={tApp(locale,'org.switch')} /></div>;
  if(invalidYear) return <div className="space-y-6">{header}<BudgetYearSelector year={currentYear} locale={locale} /><EmptyState title={tApp(locale,'budget.invalidYear')} description={tApp(locale,'budget.changeYear')} /></div>;
  const budget=await loadAnnualBudget(context.selectedOrganizationId,year);
  if(!budget.ready) return <div className="space-y-6">{header}<BudgetYearSelector year={year} locale={locale} /><EmptyState title={tApp(locale,'budget.unavailable')} description={tApp(locale,'budget.importPending')} /></div>;
  const totals=totalBudget(budget.rows);
  const derived=deriveBudget(totals);
  const tag={fi:'fi-FI',pl:'pl-PL',en:'en-GB'}[locale];
  const money=(value:number)=>new Intl.NumberFormat(tag,{style:'currency',currency:'EUR'}).format(value);
  const number=(value:number)=>new Intl.NumberFormat(tag,{maximumFractionDigits:2}).format(value);
  return <div className="space-y-6">
    {header}
    <BudgetYearSelector year={year} locale={locale} />
    {overview?<>
      {!budget.rows.length?<EmptyState title={tApp(locale,'budget.empty')} description={tApp(locale,'nav.annualBudget')} />:<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label={tApp(locale,'budget.sales_amount')} value={money(totals.sales_amount)} />
        <MetricCard label={tApp(locale,'budget.total_cost')} value={money(derived.total_cost)} />
        <MetricCard label={tApp(locale,'budget.production_m3')} value={`${number(totals.production_m3)} m³`} />
        <MetricCard label={tApp(locale,'budget.profit_margin_amount')} value={money(derived.profit_margin_amount)} />
        <MetricCard label={tApp(locale,'budget.profit_margin_percent')} value={derived.profit_margin_percent===null?'—':`${number(derived.profit_margin_percent)} %`} />
      </section>}
    </>:<AnnualBudgetEditor key={`${context.selectedOrganizationId}:${year}:${budget.rows.map(row=>row.edit_version).join(',')}`} organizationId={context.selectedOrganizationId} year={year} rows={budget.rows} locale={locale} />}
  </div>;
}
