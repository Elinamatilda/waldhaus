-- Harden sales tenant integrity (forward-only)
-- Enforces same-organization references across sales tables and
-- blocks inconsistent variant/customer pairings in sales_facts.

-- 1) Add composite uniqueness needed for organization-scoped foreign keys.
alter table public.sales_scenarios
  add constraint sales_scenarios_unique_org_id unique (organization_id, id);

alter table public.sales_periods
  add constraint sales_periods_unique_org_id unique (organization_id, id);

alter table public.customers
  add constraint customers_unique_org_id unique (organization_id, id);

alter table public.products
  add constraint products_unique_org_id unique (organization_id, id);

alter table public.product_variants
  add constraint product_variants_unique_org_id unique (organization_id, id);

alter table public.product_variants
  add constraint product_variants_unique_org_id_product_id unique (organization_id, id, product_id);

-- 2) Enforce same-organization links for product_variants.
alter table public.product_variants
  add constraint product_variants_same_org_product_fk
  foreign key (organization_id, product_id)
  references public.products (organization_id, id)
  on delete cascade;

alter table public.product_variants
  add constraint product_variants_same_org_customer_fk
  foreign key (organization_id, customer_id)
  references public.customers (organization_id, id)
  on delete set null;

-- 3) Enforce same-organization links for sales_facts.
alter table public.sales_facts
  add constraint sales_facts_same_org_scenario_fk
  foreign key (organization_id, scenario_id)
  references public.sales_scenarios (organization_id, id)
  on delete restrict;

alter table public.sales_facts
  add constraint sales_facts_same_org_period_fk
  foreign key (organization_id, period_id)
  references public.sales_periods (organization_id, id)
  on delete restrict;

alter table public.sales_facts
  add constraint sales_facts_same_org_customer_fk
  foreign key (organization_id, customer_id)
  references public.customers (organization_id, id)
  on delete restrict;

alter table public.sales_facts
  add constraint sales_facts_same_org_product_fk
  foreign key (organization_id, product_id)
  references public.products (organization_id, id)
  on delete restrict;

alter table public.sales_facts
  add constraint sales_facts_same_org_variant_fk
  foreign key (organization_id, product_variant_id)
  references public.product_variants (organization_id, id)
  on delete restrict;

-- 4) Enforce variant/product consistency inside sales_facts.
alter table public.sales_facts
  add constraint sales_facts_variant_matches_product_fk
  foreign key (organization_id, product_variant_id, product_id)
  references public.product_variants (organization_id, id, product_id)
  on delete restrict;

-- 5) Enforce customer-specific variant consistency.
-- Rule:
-- - If variant.customer_id is null, it is generic and usable with any customer.
-- - If variant.customer_id is non-null, it must match sales_facts.customer_id.
create or replace function public.enforce_sales_fact_variant_customer_consistency()
returns trigger
language plpgsql
security definer
set search_path = pg_temp
as $$
declare
  variant_customer_id uuid;
begin
  if new.product_variant_id is null then
    return new;
  end if;

  select pv.customer_id
    into variant_customer_id
  from public.product_variants as pv
  where pv.organization_id = new.organization_id
    and pv.id = new.product_variant_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'product_variant_id does not belong to organization_id';
  end if;

  if variant_customer_id is not null and variant_customer_id <> new.customer_id then
    raise exception using
      errcode = '23514',
      message = 'customer_id must match product_variant.customer_id when variant is customer-specific';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_sales_fact_variant_customer_consistency() from public;

drop trigger if exists enforce_sales_fact_variant_customer_consistency_tg on public.sales_facts;
create trigger enforce_sales_fact_variant_customer_consistency_tg
before insert or update on public.sales_facts
for each row
execute function public.enforce_sales_fact_variant_customer_consistency();
