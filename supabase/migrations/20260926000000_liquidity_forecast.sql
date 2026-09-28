-- Review-only forward migration. Do not apply without approval.
-- Liquidity source inputs are EUR-denominated and independent of accrual/sales budgets.
begin;
-- Deployment owner must have the capability to bypass FORCE RLS.
-- Check the actual executing role, regardless of its name.
-- Fail before DDL otherwise; never grant BYPASSRLS or broaden tenant policies.
do $preflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception 'Liquidity Forecast migration requires an executing role with verified SUPERUSER or BYPASSRLS; review the function owner/RLS model before deployment';
  end if;
end;
$preflight$;
create sequence public.liquidity_forecast_version_seq;
create table public.liquidity_forecast_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year_number integer not null check(year_number between 2020 and 2100),
  month_number integer not null check(month_number between 1 and 12),
  opening_balance numeric(18,2) check(opening_balance is null or (opening_balance > -1e12 and opening_balance < 1e12)),
  forecasted_sales numeric(18,2) check(forecasted_sales is null or (forecasted_sales >= 0 and forecasted_sales < 1e12)),
  other_forecasted_income numeric(18,2) check(other_forecasted_income is null or (other_forecasted_income >= 0 and other_forecasted_income < 1e12)),
  total_outflows numeric(18,2) check(total_outflows is null or (total_outflows >= 0 and total_outflows < 1e12)),
  minimum_required_balance numeric(18,2) check(minimum_required_balance is null or (minimum_required_balance >= 0 and minimum_required_balance < 1e12)),
  edit_version bigint not null default nextval('public.liquidity_forecast_version_seq'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint liquidity_forecast_periods_org_year_month_key unique(organization_id,year_number,month_number)
);
alter sequence public.liquidity_forecast_version_seq owned by public.liquidity_forecast_periods.edit_version;
comment on table public.liquidity_forecast_periods is 'Independent monthly EUR liquidity forecast. All canonical inputs preserve NULL versus zero. Opening balances never carry forward automatically. Derived inflows, net cash, closing and total sales requirement are not persisted.';
alter table public.liquidity_forecast_periods enable row level security;
alter table public.liquidity_forecast_periods force row level security;
create policy liquidity_forecast_admin_select on public.liquidity_forecast_periods for select to authenticated
using (public.is_organization_admin(organization_id));
-- Existing helper includes active System Admin, or active ADMIN membership/profile/role.
-- Browser writes use only the authorized transaction below, not direct table DML.
revoke all on public.liquidity_forecast_periods from public, anon, authenticated;
grant select on public.liquidity_forecast_periods to authenticated;
revoke all on sequence public.liquidity_forecast_version_seq from public, anon, authenticated;

create function public.liquidity_forecast_version() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  new.edit_version:=nextval('public.liquidity_forecast_version_seq');
  new.updated_at:=clock_timestamp();
  return new;
end; $$;
create trigger liquidity_forecast_period_version before update on public.liquidity_forecast_periods
for each row execute function public.liquidity_forecast_version();
-- Owner capability is verified by the deployment preflight above.
revoke all on function public.liquidity_forecast_version() from public,anon,authenticated;

create function public.save_liquidity_forecast_year(p_organization uuid,p_year integer,p_months jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  n integer; m jsonb; field text; version bigint; expected_version bigint; expected_text text;
  fields text[]:=array['opening_balance','forecasted_sales','other_forecasted_income','total_outflows','minimum_required_balance'];
begin
  if p_organization is null or auth.uid() is null or public.is_organization_admin(p_organization) is not true then
    raise exception using errcode='42501',message='Forbidden';
  end if;
  if p_year is null or p_year not between 2020 and 2100 or jsonb_typeof(p_months) is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid liquidity forecast';
  end if;
  if jsonb_array_length(p_months)<>12 then raise exception using errcode='22023',message='Twelve months required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization::text||':'||p_year::text, 493023));
  -- Validate all input and all optimistic versions before any write.
  for n in 1..12 loop
    m:=p_months->(n-1);
    if jsonb_typeof(m) is distinct from 'object' then
      raise exception using errcode='22023',message='Invalid month payload';
    end if;
    if (m->>'month_number') is distinct from n::text then raise exception using errcode='22023',message='Invalid month'; end if;
    foreach field in array fields loop
      -- All five keys are required; explicit JSON null preserves an absent input.
      if not (m ? field) then
        raise exception using errcode='22023',message='Missing liquidity forecast input field';
      end if;
      if jsonb_typeof(m->field) = 'null' then continue; end if;
      if jsonb_typeof(m->field) not in ('number','string') or length(m->>field)>24 or
        (m->>field !~ case when field='opening_balance' then '^-?[0-9]+(\.[0-9]{1,2})?$' else '^[0-9]+(\.[0-9]{1,2})?$' end) then
        raise exception using errcode='22023',message='Invalid numeric input';
      end if;
      if abs((m->>field)::numeric)>=1e12 then raise exception using errcode='22023',message='Input out of range'; end if;
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
    select edit_version into version from public.liquidity_forecast_periods
      where organization_id=p_organization and year_number=p_year and month_number=n for update;
    if found then
      if expected_version is null or version <> expected_version then
        raise exception using errcode='40001',message='Liquidity forecast changed; refresh before saving';
      end if;
    elsif expected_version is not null then
      raise exception using errcode='40001',message='Expected liquidity forecast period no longer exists';
    end if;
  end loop;
  for n in 1..12 loop
    m:=p_months->(n-1);
    if m->>'expected_version' is null then
      insert into public.liquidity_forecast_periods(organization_id,year_number,month_number,
        opening_balance,forecasted_sales,other_forecasted_income,total_outflows,minimum_required_balance,created_by,updated_by)
      values(p_organization,p_year,n,(m->>'opening_balance')::numeric,
        (m->>'forecasted_sales')::numeric,(m->>'other_forecasted_income')::numeric,
        (m->>'total_outflows')::numeric,(m->>'minimum_required_balance')::numeric,auth.uid(),auth.uid())
      on conflict (organization_id,year_number,month_number) do nothing;
      if not found then raise exception using errcode='40001',message='Liquidity forecast changed during save'; end if;
    else
      update public.liquidity_forecast_periods set
        opening_balance=(m->>'opening_balance')::numeric,
        forecasted_sales=(m->>'forecasted_sales')::numeric,
        other_forecasted_income=(m->>'other_forecasted_income')::numeric,
        total_outflows=(m->>'total_outflows')::numeric,
        minimum_required_balance=(m->>'minimum_required_balance')::numeric,updated_by=auth.uid()
      where organization_id=p_organization and year_number=p_year and month_number=n
        and edit_version=(m->>'expected_version')::bigint;
      if not found then raise exception using errcode='40001',message='Liquidity forecast changed during save'; end if;
    end if;
  end loop;
  -- Text transport preserves every bigint digit in JavaScript clients.
  return jsonb_build_object('year',p_year,'months',(
    select jsonb_agg(jsonb_build_object(
      'month_number',month_number,'edit_version',edit_version::text
    ) order by month_number)
    from public.liquidity_forecast_periods
    where organization_id=p_organization and year_number=p_year
  ));
end; $$;
revoke all on function public.save_liquidity_forecast_year(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_liquidity_forecast_year(uuid,integer,jsonb) to authenticated;
commit;
