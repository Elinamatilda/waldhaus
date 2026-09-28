-- READ ONLY: inspect current structures before designing an additive migration.
-- No customer prices, credentials or auth-user data are returned.
begin transaction read only;
with relevant as (
  select c.oid,c.relname,c.relowner,c.relrowsecurity,c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and (
    c.relname in ('products','product_variants','customers','sales_facts')
    or c.relname ~ '(species|construction|material|unit|uom|currency|customer_product|price|contract|demand|bom|routing|production_order)'
  )
), variant_usage as (
  select v.organization_id,
    count(*) as total_variants,
    count(*) filter(where v.customer_id is not null) as customer_scoped_variants,
    count(*) filter(where v.customer_id is not null and exists(
      select 1 from public.sales_facts f where f.organization_id=v.organization_id and f.product_variant_id=v.id
    )) as customer_scoped_variants_with_sales,
    count(*) filter(where v.variant_code is null or btrim(v.variant_code)='') as missing_variant_codes,
    count(*) filter(where v.depth_mm is not null) as variants_with_depth,
    count(*) filter(where v.volume_per_unit_m3 is not null) as variants_with_stored_volume,
    count(*) filter(where v.thickness_mm is not null and v.width_mm is not null and v.length_mm is not null
      and v.volume_per_unit_m3 is not null
      and round(v.thickness_mm*v.width_mm*v.length_mm/1000000000,6)<>v.volume_per_unit_m3
    ) as stored_volume_differences_at_6_decimals
  from public.product_variants v group by v.organization_id
)
select jsonb_pretty(jsonb_build_object(
  'execution_role',current_user,
  'role_capabilities',(select jsonb_build_object('superuser',rolsuper,'bypass_rls',rolbypassrls) from pg_roles where rolname=current_user),
  'tables',coalesce((select jsonb_agg(jsonb_build_object(
    'name',r.relname,'owner',pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid)) order by conname) from pg_constraint where conrelid=r.oid),
    'indexes',(select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='public' and tablename=r.relname),
    'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public' and tablename=r.relname),
    'grants',(select jsonb_agg(jsonb_build_object('role',grantee,'privilege',privilege_type)) from information_schema.table_privileges where table_schema='public' and table_name=r.relname),
    'column_grants',(select jsonb_agg(jsonb_build_object('column',column_name,'role',grantee,'privilege',privilege_type)) from information_schema.column_privileges where table_schema='public' and table_name=r.relname),
    'triggers',(select jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid))) from pg_trigger where tgrelid=r.oid and not tgisinternal)
  ) order by r.relname) from relevant r),'[]'::jsonb),
  'referencing_foreign_keys',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint where contype='f' and confrelid in ('public.products'::regclass,'public.product_variants'::regclass)),
  'variant_usage',coalesce((select jsonb_agg(to_jsonb(v) order by organization_id) from variant_usage v),'[]'::jsonb),
  'units_in_use',jsonb_build_object(
    'variant_defaults',(select jsonb_agg(distinct default_quantity_unit_code) from public.product_variants where default_quantity_unit_code is not null),
    'sales_quantity',(select jsonb_agg(distinct quantity_unit_code) from public.sales_facts where quantity_unit_code is not null),
    'sales_price_basis',(select jsonb_agg(distinct pricing_basis_code) from public.sales_facts where pricing_basis_code is not null),
    'sales_currency',(select jsonb_agg(distinct currency_code) from public.sales_facts where currency_code is not null)
  ),
  'product_variant_functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid)))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and
    (p.proname in ('save_sales_year','sales_variant_integrity','enforce_sales_fact_variant_customer_consistency')
    or p.oid in (select tgfoid from pg_trigger where tgrelid='public.product_variants'::regclass and not tgisinternal)))
)) as report;
rollback;
