import { BudgetScreen } from '@/components/budget/screen';
export default function BudgetOverviewPage({searchParams}:{searchParams?:Promise<{year?:string}>}) {
  return <BudgetScreen searchParams={searchParams} overview />;
}
