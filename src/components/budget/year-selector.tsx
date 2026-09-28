import { Button, FormField, Select } from '@/components/ui';
import { BUDGET_YEARS } from '@/lib/budget/model';
import { tApp } from '@/lib/i18n/app-ui';
import type { AppLocale } from '@/lib/i18n/config';
export function BudgetYearSelector({year,locale}:{year:number;locale:AppLocale}) {
  return <form method="get" className="flex items-end gap-3">
    <FormField label={tApp(locale,'budget.year')} htmlFor="budget-year">
      <Select id="budget-year" name="year" defaultValue={year} key={year}>
        {BUDGET_YEARS.map(value=><option key={value} value={value}>{value}</option>)}
      </Select>
    </FormField>
    <Button type="submit" variant="secondary">{tApp(locale,'budget.changeYear')}</Button>
  </form>;
}
