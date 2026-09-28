import Link from "next/link";
import { requireRole } from '@/lib/auth/session';
import { getProductVariantCounts } from '@/lib/products/service';
import { tProduct } from '@/lib/i18n/product-master-ui';
import { Button, FormField, Input, EmptyState, PageHeader } from "@/components/ui";
import { ProductsManager } from "@/components/sales/products-manager";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tSales } from "@/lib/i18n/sales-ui";
import { resolveSalesScope } from "@/lib/sales/scope";
import { assertSalesSchemaReady, listProducts } from "@/lib/sales/service";
import { resolveSalesSearchParams } from "@/lib/sales/search-params";

export default async function SalesProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string; q?: string; page?: string }>;
}) {
  await requireRole('admin');
  const params = await resolveSalesSearchParams(searchParams);
  const locale = await getRequestLocale();
  const scope = await resolveSalesScope();
  const schema = await assertSalesSchemaReady();

  if (!scope.organizationId) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={tSales(locale, "sales.group")} title={tSales(locale, "sales.products")} />
        <EmptyState title={tSales(locale, "org.select")} description={tSales(locale, "org.switch")} />
      </div>
    );
  }

  if (!schema.ready) {
    return <EmptyState title={tSales(locale, "sales.schemaMissing")} description={schema.message} />;
  }

  const requestedPage = Number(params.page ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 100000 ? requestedPage : 1;
  const rows = await listProducts(scope.organizationId, params.q, page);

  const counts = rows.length ? await getProductVariantCounts(scope.organizationId, rows.map(row => row.id)) : {};

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={tSales(locale, "sales.group")}
        title={tSales(locale, "sales.products")}
        description={tProduct(locale, "overview")}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form action="" method="get" className="flex items-end gap-2">
          {scope.isSystemAdmin ? <input type="hidden" name="org" value={scope.organizationId} /> : null}
          <FormField label={tSales(locale, 'sales.search')} htmlFor="product-search">
            <Input id="product-search" type="search" name="q" defaultValue={params.q ?? ''} placeholder={tSales(locale, 'sales.product')} />
          </FormField>
          <Button type="submit">{tSales(locale, 'sales.search')}</Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={tSales(locale, "sales.noData")} description={tSales(locale, "sales.empty")} />
      ) : null}
        <ProductsManager
          locale={locale}
          rows={rows.map(row => ({...row, variant_count: counts[row.id] ?? 0}))}
          organizationId={scope.organizationId}
          isSystemAdmin={scope.isSystemAdmin}
        />
      <nav className="flex gap-4" aria-label={tProduct(locale, "pagination")}>
        {page > 1 ? <Link href={`?q=${encodeURIComponent(params.q ?? "")}&page=${page-1}`}>{tProduct(locale, "previous")}</Link> : null}
        <span>{page}</span>
        {rows.length === 200 ? <Link href={`?q=${encodeURIComponent(params.q ?? "")}&page=${page+1}`}>{tProduct(locale, "next")}</Link> : null}
      </nav>
    </div>
  );
}
