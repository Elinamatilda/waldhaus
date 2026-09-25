-- Waldhaus Sales foundation (phase 1)
-- Scope:
-- - customers
-- - products
-- - product_variants
-- - sales scenarios
-- - monthly periods
-- - sales monthly facts (budget/forecast/actual)
--
-- Notes:
-- - forward-only migration
-- - organization-scoped data
-- - customer and product identities are always separate

create table if not exists public.sales_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name_key text not null,
  description_key text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_scenarios_unique_org_code unique (organization_id, code)
);

comment on table public.sales_scenarios is 'Organization-scoped sales scenario catalog (BUDGET/FORECAST/ACTUAL).';
comment on column public.sales_scenarios.code is 'Canonical scenario code, language-independent.';

create table if not exists public.sales_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  year_number integer not null,
  month_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_periods_month_number_check check (month_number between 1 and 12),
  constraint sales_periods_period_start_month_check check (period_start = date_trunc('month', period_start)::date),
  constraint sales_periods_year_month_match_check check (
    year_number = extract(year from period_start)::integer
    and month_number = extract(month from period_start)::integer
  ),
  constraint sales_periods_unique_org_period unique (organization_id, period_start)
);

comment on table public.sales_periods is 'Organization-scoped monthly reporting periods for sales planning and actuals.';

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_code text,
  name text not null,
  is_active boolean not null default true,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_unique_org_name unique (organization_id, name),
  constraint customers_unique_org_code unique (organization_id, customer_code)
);

comment on table public.customers is 'Canonical customer/company identities for commercial planning.';
comment on column public.customers.customer_code is 'Optional organization-scoped code for customer identity.';

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_code text,
  name text not null,
  description text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_unique_org_name unique (organization_id, name),
  constraint products_unique_org_code unique (organization_id, product_code)
);

comment on table public.products is 'Canonical product identities independent of customer identity.';

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  variant_code text,
  variant_name text,
  quality_code text,
  quality_label_raw text,
  thickness_mm numeric(10,3),
  width_mm numeric(10,3),
  depth_mm numeric(10,3),
  length_mm numeric(10,3),
  volume_per_unit_m3 numeric(18,6),
  default_quantity_unit_code text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_unique_org_code unique (organization_id, variant_code),
  constraint product_variants_positive_dimensions_check check (
    (thickness_mm is null or thickness_mm > 0)
    and (width_mm is null or width_mm > 0)
    and (depth_mm is null or depth_mm > 0)
    and (length_mm is null or length_mm > 0)
    and (volume_per_unit_m3 is null or volume_per_unit_m3 > 0)
  )
);

comment on table public.product_variants is 'Optional specification-level product variants; may be customer-specific but always tied to product.';

create table if not exists public.sales_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scenario_id uuid not null references public.sales_scenarios (id) on delete restrict,
  period_id uuid not null references public.sales_periods (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_variant_id uuid references public.product_variants (id) on delete restrict,
  quantity_value numeric(18,6),
  quantity_unit_code text,
  volume_m3 numeric(18,6),
  unit_price_amount numeric(18,6),
  pricing_basis_code text,
  revenue_amount numeric(18,2) not null,
  currency_code text not null default 'EUR',
  source_label_raw text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_facts_positive_values_check check (
    (quantity_value is null or quantity_value >= 0)
    and (volume_m3 is null or volume_m3 >= 0)
    and (unit_price_amount is null or unit_price_amount >= 0)
  ),
  constraint sales_facts_pricing_basis_check check (
    pricing_basis_code is null
    or pricing_basis_code in ('PER_PIECE', 'PER_M3')
  ),
  constraint sales_facts_currency_code_check check (char_length(currency_code) = 3)
);

comment on table public.sales_facts is 'Central monthly commercial fact table for budget/forecast/actual by customer and product with optional variant.';

create unique index if not exists sales_facts_unique_monthly_without_variant_idx
on public.sales_facts (organization_id, scenario_id, period_id, customer_id, product_id)
where product_variant_id is null;

create unique index if not exists sales_facts_unique_monthly_with_variant_idx
on public.sales_facts (organization_id, scenario_id, period_id, customer_id, product_id, product_variant_id)
where product_variant_id is not null;

create index if not exists sales_facts_org_period_idx
on public.sales_facts (organization_id, period_id);

create index if not exists sales_facts_org_customer_idx
on public.sales_facts (organization_id, customer_id);

create index if not exists sales_facts_org_product_idx
on public.sales_facts (organization_id, product_id);

-- Seed default scenarios for all existing organizations.
insert into public.sales_scenarios (organization_id, code, name_key, description_key, sort_order, is_active)
select
  o.id,
  s.code,
  s.name_key,
  s.description_key,
  s.sort_order,
  true
from public.organizations as o
cross join (
  values
    ('BUDGET', 'sales.scenario.budget.name', 'sales.scenario.budget.description', 10),
    ('FORECAST', 'sales.scenario.forecast.name', 'sales.scenario.forecast.description', 20),
    ('ACTUAL', 'sales.scenario.actual.name', 'sales.scenario.actual.description', 30)
) as s(code, name_key, description_key, sort_order)
on conflict (organization_id, code) do update
set
  name_key = excluded.name_key,
  description_key = excluded.description_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create or replace function public.seed_sales_scenarios_for_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_temp
as $$
begin
  insert into public.sales_scenarios (organization_id, code, name_key, description_key, sort_order, is_active)
  values
    (new.id, 'BUDGET', 'sales.scenario.budget.name', 'sales.scenario.budget.description', 10, true),
    (new.id, 'FORECAST', 'sales.scenario.forecast.name', 'sales.scenario.forecast.description', 20, true),
    (new.id, 'ACTUAL', 'sales.scenario.actual.name', 'sales.scenario.actual.description', 30, true)
  on conflict (organization_id, code) do nothing;

  return new;
end;
$$;

revoke all on function public.seed_sales_scenarios_for_organization() from public;

drop trigger if exists on_organization_created_seed_sales_scenarios on public.organizations;
create trigger on_organization_created_seed_sales_scenarios
after insert on public.organizations
for each row
execute function public.seed_sales_scenarios_for_organization();

create or replace function public.can_manage_sales_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_temp
as $$
  select public.is_system_admin() or public.is_organization_admin(target_organization_id);
$$;

revoke all on function public.can_manage_sales_organization(uuid) from public;
grant execute on function public.can_manage_sales_organization(uuid) to authenticated;

drop trigger if exists set_sales_scenarios_updated_at on public.sales_scenarios;
create trigger set_sales_scenarios_updated_at
before update on public.sales_scenarios
for each row
execute function public.set_updated_at();

drop trigger if exists set_sales_periods_updated_at on public.sales_periods;
create trigger set_sales_periods_updated_at
before update on public.sales_periods
for each row
execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

drop trigger if exists set_product_variants_updated_at on public.product_variants;
create trigger set_product_variants_updated_at
before update on public.product_variants
for each row
execute function public.set_updated_at();

drop trigger if exists set_sales_facts_updated_at on public.sales_facts;
create trigger set_sales_facts_updated_at
before update on public.sales_facts
for each row
execute function public.set_updated_at();

revoke all on public.sales_scenarios from anon;
revoke all on public.sales_scenarios from authenticated;
revoke all on public.sales_periods from anon;
revoke all on public.sales_periods from authenticated;
revoke all on public.customers from anon;
revoke all on public.customers from authenticated;
revoke all on public.products from anon;
revoke all on public.products from authenticated;
revoke all on public.product_variants from anon;
revoke all on public.product_variants from authenticated;
revoke all on public.sales_facts from anon;
revoke all on public.sales_facts from authenticated;

grant select, insert, update, delete on public.sales_scenarios to authenticated;
grant select, insert, update, delete on public.sales_periods to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select, insert, update, delete on public.sales_facts to authenticated;

alter table public.sales_scenarios enable row level security;
alter table public.sales_scenarios force row level security;
alter table public.sales_periods enable row level security;
alter table public.sales_periods force row level security;
alter table public.customers enable row level security;
alter table public.customers force row level security;
alter table public.products enable row level security;
alter table public.products force row level security;
alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;
alter table public.sales_facts enable row level security;
alter table public.sales_facts force row level security;

-- sales_scenarios policies
create policy "sales_scenarios_select_sales_admin_or_system"
on public.sales_scenarios
for select
to authenticated
using (public.can_manage_sales_organization(organization_id));

create policy "sales_scenarios_insert_sales_admin_or_system"
on public.sales_scenarios
for insert
to authenticated
with check (public.can_manage_sales_organization(organization_id));

create policy "sales_scenarios_update_sales_admin_or_system"
on public.sales_scenarios
for update
to authenticated
using (public.can_manage_sales_organization(organization_id))
with check (public.can_manage_sales_organization(organization_id));

create policy "sales_scenarios_delete_sales_admin_or_system"
on public.sales_scenarios
for delete
to authenticated
using (public.can_manage_sales_organization(organization_id));

-- sales_periods policies
create policy "sales_periods_select_sales_admin_or_system"
on public.sales_periods
for select
to authenticated
using (public.can_manage_sales_organization(organization_id));

create policy "sales_periods_insert_sales_admin_or_system"
on public.sales_periods
for insert
to authenticated
with check (public.can_manage_sales_organization(organization_id));

create policy "sales_periods_update_sales_admin_or_system"
on public.sales_periods
for update
to authenticated
using (public.can_manage_sales_organization(organization_id))
with check (public.can_manage_sales_organization(organization_id));

create policy "sales_periods_delete_sales_admin_or_system"
on public.sales_periods
for delete
to authenticated
using (public.can_manage_sales_organization(organization_id));

-- customers policies
create policy "customers_select_sales_admin_or_system"
on public.customers
for select
to authenticated
using (public.can_manage_sales_organization(organization_id));

create policy "customers_insert_sales_admin_or_system"
on public.customers
for insert
to authenticated
with check (public.can_manage_sales_organization(organization_id));

create policy "customers_update_sales_admin_or_system"
on public.customers
for update
to authenticated
using (public.can_manage_sales_organization(organization_id))
with check (public.can_manage_sales_organization(organization_id));

create policy "customers_delete_sales_admin_or_system"
on public.customers
for delete
to authenticated
using (public.can_manage_sales_organization(organization_id));

-- products policies
create policy "products_select_sales_admin_or_system"
on public.products
for select
to authenticated
using (public.can_manage_sales_organization(organization_id));

create policy "products_insert_sales_admin_or_system"
on public.products
for insert
to authenticated
with check (public.can_manage_sales_organization(organization_id));

create policy "products_update_sales_admin_or_system"
on public.products
for update
to authenticated
using (public.can_manage_sales_organization(organization_id))
with check (public.can_manage_sales_organization(organization_id));

create policy "products_delete_sales_admin_or_system"
on public.products
for delete
to authenticated
using (public.can_manage_sales_organization(organization_id));

-- product_variants policies
create policy "product_variants_select_sales_admin_or_system"
on public.product_variants
for select
to authenticated
using (public.can_manage_sales_organization(organization_id));

create policy "product_variants_insert_sales_admin_or_system"
on public.product_variants
for insert
to authenticated
with check (public.can_manage_sales_organization(organization_id));

create policy "product_variants_update_sales_admin_or_system"
on public.product_variants
for update
to authenticated
using (public.can_manage_sales_organization(organization_id))
with check (public.can_manage_sales_organization(organization_id));

create policy "product_variants_delete_sales_admin_or_system"
on public.product_variants
for delete
to authenticated
using (public.can_manage_sales_organization(organization_id));

-- sales_facts policies
create policy "sales_facts_select_sales_admin_or_system"
on public.sales_facts
for select
to authenticated
using (public.can_manage_sales_organization(organization_id));

create policy "sales_facts_insert_sales_admin_or_system"
on public.sales_facts
for insert
to authenticated
with check (public.can_manage_sales_organization(organization_id));

create policy "sales_facts_update_sales_admin_or_system"
on public.sales_facts
for update
to authenticated
using (public.can_manage_sales_organization(organization_id))
with check (public.can_manage_sales_organization(organization_id));

create policy "sales_facts_delete_sales_admin_or_system"
on public.sales_facts
for delete
to authenticated
using (public.can_manage_sales_organization(organization_id));
