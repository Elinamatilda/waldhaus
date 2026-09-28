import { Button, FormField, Select } from '@/components/ui';
import { BUDGET_YEARS } from '@/lib/budget/model';
import { ANALYSIS_SCENARIOS, type CustomerAnalysisFilters } from '@/lib/sales/customer-analysis';
import { tApp } from '@/lib/i18n/app-ui';
import { tScenarioCode } from '@/lib/i18n/sales-ui';
import type { AppLocale } from '@/lib/i18n/config';
export function CustomerAnalysisFilterBar({ filters, locale }: { filters: CustomerAnalysisFilters; locale: AppLocale }) {
  return <form method="get" className="flex flex-wrap items-end gap-3">
    <FormField label={tApp(locale, 'sales.year')} htmlFor="customer-year"><Select name="year" id="customer-year" defaultValue={filters.year} key={filters.year}>{BUDGET_YEARS.map(year => <option value={year} key={year}>{year}</option>)}</Select></FormField>
    <FormField label={tApp(locale, 'sales.scenario')} htmlFor="customer-scenario"><Select name="scenario" id="customer-scenario" defaultValue={filters.scenario} key={filters.scenario}>{ANALYSIS_SCENARIOS.map(code => <option value={code} key={code}>{tScenarioCode(locale, code)}</option>)}</Select></FormField>
    <Button variant="secondary" type="submit">{tApp(locale, 'customerAnalysis.apply')}</Button>
    <p className="text-body-small text-text-secondary">{tApp(locale, 'customerAnalysis.currency')}</p>
  </form>;
}
