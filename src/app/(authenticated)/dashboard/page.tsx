import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/session';
import { EmptyState, PageHeader } from '@/components/ui';
import { BudgetYearSelector } from '@/components/budget/year-selector';
import { ManagementDashboard } from '@/components/dashboard/management-dashboard';
import { loadDashboardData } from '@/lib/dashboard/service';
import { getRequestLocale } from '@/lib/i18n/locale';
import { tApp } from '@/lib/i18n/app-ui';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ year?: string | string[] }> }) {
  const auth = await requireProfile();
  if (!auth.profile.is_system_admin && auth.membership?.role === 'employee') redirect('/production');
  const [locale, params] = await Promise.all([getRequestLocale(), searchParams]);
  const currentYear = new Date().getUTCFullYear();
  const result = await loadDashboardData(params.year ?? currentYear);
  const year = result.kind === 'ready' ? result.data.year : result.kind === 'no-organization' ? result.year : currentYear;
  return <div className="min-w-0 space-y-6">
    <PageHeader title={tApp(locale, 'dashboard.title')} description={result.context.selectedOrganization?.name} actions={<BudgetYearSelector year={year} locale={locale} />} />
    {result.kind === 'no-organization' ? <EmptyState title={tApp(locale, 'org.select')} description={tApp(locale, 'org.switch')} /> : result.kind === 'invalid-year' ? <EmptyState title={tApp(locale, 'budget.invalidYear')} description={tApp(locale, 'budget.changeYear')} /> : <ManagementDashboard data={result.data} locale={locale} />}
  </div>;
}
