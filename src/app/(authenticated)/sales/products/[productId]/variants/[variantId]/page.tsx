import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { resolveSalesScope } from '@/lib/sales/scope';
import { getRequestLocale } from '@/lib/i18n/locale';
import { tSales } from '@/lib/i18n/sales-ui';
import { tApp } from '@/lib/i18n/app-ui';
import { tProduct } from '@/lib/i18n/product-master-ui';
import { getProductMasterDefinition, loadProductLookups, productMasterReady } from '@/lib/products/service';
import { listCustomers } from '@/lib/sales/service';
import { EmptyState, PageHeader } from '@/components/ui';
import { ProductMasterManager } from '@/components/sales/product-master-manager';

export default async function ProductVariantPage({params}: {params: Promise<{productId: string; variantId: string}>}) {
  await requireRole('admin');
  const locale = await getRequestLocale();
  const scope = await resolveSalesScope();
  if (!scope.organizationId) return <EmptyState title={tSales(locale, 'org.select')} description={tSales(locale, 'org.switch')} />;
  if (!await productMasterReady(scope.organizationId)) return <EmptyState title={tApp(locale, 'productMaster.unavailable')} description={tProduct(locale, 'unavailable')} />;
  const {productId, variantId} = await params;
  const definition = await getProductMasterDefinition(scope.organizationId, productId, locale);
  const variant = definition?.variants.find(row => row.id === variantId);
  if (!definition || !variant) notFound();
  const [lookups, customers] = await Promise.all([loadProductLookups(scope.organizationId), listCustomers(scope.organizationId)]);
  return <div className="space-y-6">
    <PageHeader eyebrow={definition.product.name} title={variant.variant_name ?? variant.variant_code ?? tProduct(locale, 'variants')} description={variant.variant_code ?? undefined} />
    <Link className="text-primary hover:underline" href={`/sales/products/${productId}`}>{tProduct(locale, 'backProduct')}</Link>
    <ProductMasterManager key={`${scope.organizationId}:${variantId}`} organizationId={scope.organizationId} locale={locale} definition={definition} lookups={lookups} customers={customers} variantId={variantId} />
  </div>;
}
