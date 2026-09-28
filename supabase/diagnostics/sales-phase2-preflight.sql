-- One read-only, pretty-JSON report. Run before reviewing deployment; no DDL.
begin transaction read only;
select jsonb_pretty(jsonb_build_object(
 'existing_phase2_functions', (select coalesce(jsonb_agg(p.oid::regprocedure::text),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_sales_year','sales_report','sales_variant_integrity','sales_fact_version')),
 'sales_fact_grants', (select jsonb_agg(to_jsonb(g)) from information_schema.role_table_grants g where table_schema='public' and table_name='sales_facts'),
 'sales_fact_column_grants', (select jsonb_agg(to_jsonb(g)) from information_schema.column_privileges g where table_schema='public' and table_name='sales_facts'),
 'incompatible_variants', (select count(*) from public.sales_facts f join public.product_variants v on v.id=f.product_variant_id where v.organization_id<>f.organization_id or v.product_id<>f.product_id or (v.customer_id is not null and v.customer_id<>f.customer_id)),
 'nonstandard_units', (select jsonb_agg(distinct quantity_unit_code) from public.sales_facts where quantity_unit_code not in ('PIECE','LINEAR_METER')),
 'negative_revenue_rows', (select count(*) from public.sales_facts where revenue_amount<0),
 'currencies', (select jsonb_agg(distinct currency_code) from public.sales_facts),
 'migration_history_exists', to_regclass('supabase_migrations.schema_migrations') is not null
)) as report;
rollback;
