import { Card, Skeleton } from '@/components/ui';
import { getRequestLocale } from '@/lib/i18n/locale';
import { tApp } from '@/lib/i18n/app-ui';
export default async function CustomerAnalysisLoading() {
  const locale = await getRequestLocale();
  return <div className="min-w-0 space-y-6" role="status" aria-label={tApp(locale, 'customerAnalysis.loading')}>
    <Skeleton className="h-10 w-64" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Card key={i}><Skeleton className="h-20 w-full" /></Card>)}</div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <Card key={i}><Skeleton className="h-80 w-full" /></Card>)}</div>
    <Card><Skeleton className="h-80 w-full" /></Card>
  </div>;
}
