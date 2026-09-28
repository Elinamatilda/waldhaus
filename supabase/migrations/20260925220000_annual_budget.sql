-- Review-only forward migration. Do not apply without approval.
-- Annual operational budgets are EUR-denominated, independent of sales_facts.
begin;
-- Explicit deployment contract: the observed Supabase owner is postgres. FORCE
-- RLS is bypassed by this owner ONLY if pg_roles confirms SUPERUSER/BYPASSRLS.
-- Fail before DDL otherwise; never grant BYPASSRLS or broaden tenant policies.
do $preflight$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception 'Annual Budget migration requires postgres with verified SUPERUSER or BYPASSRLS; review the function owner/RLS model before deployment';
  end if;
end;
$preflight$;
create sequence public.annual_budget_version_seq;
create table public.annual_budget_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year_number integer not null check(year_number between 2020 and 2100),
  month_number integer not null check(month_number between 1 and 12),
  sales_amount numeric(18,2) check(sales_amount is null or (sales_amount >= 0 and sales_amount < 1e12)),
  raw_material_cost numeric(18,2) check(raw_material_cost is null or (raw_material_cost >= 0 and raw_material_cost < 1e12)),
  energy_cost numeric(18,2) check(energy_cost is null or (energy_cost >= 0 and energy_cost < 1e12)),
  labor_cost numeric(18,2) check(labor_cost is null or (labor_cost >= 0 and labor_cost < 1e12)),
  maintenance_repairs_cost numeric(18,2) check(maintenance_repairs_cost is null or (maintenance_repairs_cost >= 0 and maintenance_repairs_cost < 1e12)),
  transportation_logistics_cost numeric(18,2) check(transportation_logistics_cost is null or (transportation_logistics_cost >= 0 and transportation_logistics_cost < 1e12)),
  administration_sales_cost numeric(18,2) check(administration_sales_cost is null or (administration_sales_cost >= 0 and administration_sales_cost < 1e12)),
  waste_environmental_cost numeric(18,2) check(waste_environmental_cost is null or (waste_environmental_cost >= 0 and waste_environmental_cost < 1e12)),
  production_m3 numeric(18,6) check(production_m3 is null or (production_m3 >= 0 and production_m3 < 1e12)),
  edit_version bigint not null default nextval('public.annual_budget_version_seq'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annual_budget_periods_org_year_month_key unique(organization_id,year_number,month_number)
);
comment on table public.annual_budget_periods is 'Monthly manual organization-wide operational budget. All monetary inputs are EUR. NULL means no entered budget value; zero is an explicitly entered zero. Derived costs and margins are not persisted. No link to customer/product facts.';
alter table public.annual_budget_periods enable row level security;
alter table public.annual_budget_periods force row level security;
create policy annual_budget_admin_select on public.annual_budget_periods for select to authenticated
using (public.is_organization_admin(organization_id));
-- Existing helper includes active System Admin, or active ADMIN membership/profile/role.
-- Browser writes use only the authorized transaction below, not direct table DML.
revoke all on public.annual_budget_periods from public, anon, authenticated;
grant select on public.annual_budget_periods to authenticated;
revoke all on sequence public.annual_budget_version_seq from public, anon, authenticated;

create function public.annual_budget_version() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  new.edit_version:=nextval('public.annual_budget_version_seq');
  new.updated_at:=clock_timestamp();
  return new;
end; $$;
create trigger annual_budget_period_version before update on public.annual_budget_periods
for each row execute function public.annual_budget_version();
-- Owner is postgres, verified by the deployment preflight above.
revoke all on function public.annual_budget_version() from public,anon,authenticated;

create function public.save_annual_budget_year(p_organization uuid,p_year integer,p_months jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  n integer; m jsonb; field text; version bigint; expected_version bigint; expected_text text;
  fields text[]:=array['sales_amount','raw_material_cost','energy_cost','labor_cost',
    'maintenance_repairs_cost','transportation_logistics_cost','administration_sales_cost',
    'waste_environmental_cost','production_m3'];
begin
  if auth.uid() is null or not public.is_organization_admin(p_organization) then
    raise exception using errcode='42501',message='Forbidden';
  end if;
  if p_year is null or p_year not between 2020 and 2100 or jsonb_typeof(p_months) is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid annual budget';
  end if;
  if jsonb_array_length(p_months)<>12 then raise exception using errcode='22023',message='Twelve months required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization::text||':'||p_year::text, 493021));
  -- Validate all input and all optimistic versions before any write.
  for n in 1..12 loop
    m:=p_months->(n-1);
    if (m->>'month_number') is distinct from n::text then raise exception using errcode='22023',message='Invalid month'; end if;
    foreach field in array fields loop
      -- Require every source-field key; JSON null means absent, never malformed.
      -- Omitted keys are rejected so a partial payload cannot accidentally clear data.
      if not (m ? field) then
        raise exception using errcode='22023',message='Missing budget input field';
      end if;
      if jsonb_typeof(m->field) = 'null' then continue; end if;
      if jsonb_typeof(m->field) not in ('number','string') or length(m->>field)>24 or
        (m->>field !~ case when field='production_m3' then '^[0-9]+(\.[0-9]{1,6})?$' else '^[0-9]+(\.[0-9]{1,2})?$' end) then
        raise exception using errcode='22023',message='Invalid nonnegative numeric input';
      end if;
      if (m->>field)::numeric>=1e12 then raise exception using errcode='22023',message='Input out of range'; end if;
    end loop;
    expected_text := m->>'expected_version';
    expected_version := null;
    if expected_text is not null then
      -- Empty-string normalization belongs to the form boundary, not the RPC.
      if expected_text !~ '^[0-9]+$' or length(expected_text)>19 then
        raise exception using errcode='22023',message='Invalid expected version';
      end if;
      if expected_text::numeric > 9223372036854775807 then
        raise exception using errcode='22023',message='Expected version out of bigint range';
      end if;
      expected_version := expected_text::bigint;
    end if;
    select edit_version into version from public.annual_budget_periods
      where organization_id=p_organization and year_number=p_year and month_number=n for update;
    if found then
      if expected_version is null or version <> expected_version then
        raise exception using errcode='40001',message='Budget changed; refresh before saving';
      end if;
    elsif expected_version is not null then
      raise exception using errcode='40001',message='Expected budget period no longer exists';
    end if;
  end loop;
  for n in 1..12 loop
    m:=p_months->(n-1);
    if m->>'expected_version' is null then
      insert into public.annual_budget_periods(organization_id,year_number,month_number,
        sales_amount,raw_material_cost,energy_cost,labor_cost,maintenance_repairs_cost,
        transportation_logistics_cost,administration_sales_cost,waste_environmental_cost,
        production_m3,created_by,updated_by)
      values(p_organization,p_year,n,
        (m->>'sales_amount')::numeric,(m->>'raw_material_cost')::numeric,(m->>'energy_cost')::numeric,
        (m->>'labor_cost')::numeric,(m->>'maintenance_repairs_cost')::numeric,
        (m->>'transportation_logistics_cost')::numeric,(m->>'administration_sales_cost')::numeric,
        (m->>'waste_environmental_cost')::numeric,(m->>'production_m3')::numeric,auth.uid(),auth.uid());
    else
      update public.annual_budget_periods set
        sales_amount=(m->>'sales_amount')::numeric,raw_material_cost=(m->>'raw_material_cost')::numeric,
        energy_cost=(m->>'energy_cost')::numeric,labor_cost=(m->>'labor_cost')::numeric,
        maintenance_repairs_cost=(m->>'maintenance_repairs_cost')::numeric,
        transportation_logistics_cost=(m->>'transportation_logistics_cost')::numeric,
        administration_sales_cost=(m->>'administration_sales_cost')::numeric,
        waste_environmental_cost=(m->>'waste_environmental_cost')::numeric,
        production_m3=(m->>'production_m3')::numeric,updated_by=auth.uid()
      where organization_id=p_organization and year_number=p_year and month_number=n
        and edit_version=(m->>'expected_version')::bigint;
      if not found then raise exception using errcode='40001',message='Budget changed during save'; end if;
    end if;
  end loop;
end; $$;
revoke all on function public.save_annual_budget_year(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_annual_budget_year(uuid,integer,jsonb) to authenticated;
commit;
