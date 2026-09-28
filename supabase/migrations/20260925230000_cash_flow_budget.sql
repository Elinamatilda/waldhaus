-- Review-only forward migration. Do not apply without approval.
-- Cash flow inputs are EUR-denominated and independent of accrual/sales budgets.
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
    raise exception 'Cash Flow Budget migration requires an executing role with verified SUPERUSER or BYPASSRLS; review the function owner/RLS model before deployment';
  end if;
end;
$preflight$;
create sequence public.cash_flow_budget_version_seq;
create table public.cash_flow_budget_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year_number integer not null check(year_number between 2020 and 2100),
  month_number integer not null check(month_number between 1 and 12),
  -- Only January has a canonical opening input. Later openings are derived.
  opening_balance numeric(18,2),
  constraint cash_flow_opening_input check (
    (month_number=1 and opening_balance is not null and opening_balance > -1e12 and opening_balance < 1e12)
    or (month_number<>1 and opening_balance is null)
  ),
  sales_revenue numeric(18,2) check(sales_revenue is null or (sales_revenue >= 0 and sales_revenue < 1e12)),
  other_income numeric(18,2) check(other_income is null or (other_income >= 0 and other_income < 1e12)),
  operating_costs numeric(18,2) check(operating_costs is null or (operating_costs >= 0 and operating_costs < 1e12)),
  investments numeric(18,2) check(investments is null or (investments >= 0 and investments < 1e12)),
  loan_payments numeric(18,2) check(loan_payments is null or (loan_payments >= 0 and loan_payments < 1e12)),
  edit_version bigint not null default nextval('public.cash_flow_budget_version_seq'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_flow_budget_periods_org_year_month_key unique(organization_id,year_number,month_number)
);
alter sequence public.cash_flow_budget_version_seq owned by public.cash_flow_budget_periods.edit_version;
comment on table public.cash_flow_budget_periods is 'EUR cash receipts and payments, independent of accrual budgets. January opening may be negative; later openings and all closing balances are derived, never persisted.';
alter table public.cash_flow_budget_periods enable row level security;
alter table public.cash_flow_budget_periods force row level security;
create policy cash_flow_budget_admin_select on public.cash_flow_budget_periods for select to authenticated
using (public.is_organization_admin(organization_id));
-- Existing helper includes active System Admin, or active ADMIN membership/profile/role.
-- Browser writes use only the authorized transaction below, not direct table DML.
revoke all on public.cash_flow_budget_periods from public, anon, authenticated;
grant select on public.cash_flow_budget_periods to authenticated;
revoke all on sequence public.cash_flow_budget_version_seq from public, anon, authenticated;

create function public.cash_flow_budget_version() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  new.edit_version:=nextval('public.cash_flow_budget_version_seq');
  new.updated_at:=clock_timestamp();
  return new;
end; $$;
create trigger cash_flow_budget_period_version before update on public.cash_flow_budget_periods
for each row execute function public.cash_flow_budget_version();
-- Owner capability is verified by the deployment preflight above.
revoke all on function public.cash_flow_budget_version() from public,anon,authenticated;

create function public.save_cash_flow_budget_year(p_organization uuid,p_year integer,p_opening_balance numeric,p_months jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  n integer; m jsonb; field text; version bigint; expected_version bigint; expected_text text;
  fields text[]:=array['sales_revenue','other_income','operating_costs','investments','loan_payments'];
begin
  if p_organization is null or auth.uid() is null or public.is_organization_admin(p_organization) is not true then
    raise exception using errcode='42501',message='Forbidden';
  end if;
  if p_year is null or p_year not between 2020 and 2100 or jsonb_typeof(p_months) is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid Cash Flow Budget';
  end if;
  if jsonb_array_length(p_months)<>12 then raise exception using errcode='22023',message='Twelve months required'; end if;
  if p_opening_balance is null or not (p_opening_balance > -1e12 and p_opening_balance < 1e12) or p_opening_balance <> round(p_opening_balance,2) then
    raise exception using errcode='22023',message='Invalid opening balance';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization::text||':'||p_year::text, 493022));
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
        raise exception using errcode='22023',message='Missing Cash Flow Budget input field';
      end if;
      if jsonb_typeof(m->field) = 'null' then continue; end if;
      if jsonb_typeof(m->field) not in ('number','string') or length(m->>field)>24 or
        (m->>field !~ '^[0-9]+(\.[0-9]{1,2})?$') then
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
    select edit_version into version from public.cash_flow_budget_periods
      where organization_id=p_organization and year_number=p_year and month_number=n for update;
    if found then
      if expected_version is null or version <> expected_version then
        raise exception using errcode='40001',message='Cash Flow Budget changed; refresh before saving';
      end if;
    elsif expected_version is not null then
      raise exception using errcode='40001',message='Expected Cash Flow Budget period no longer exists';
    end if;
  end loop;
  for n in 1..12 loop
    m:=p_months->(n-1);
    if m->>'expected_version' is null then
      insert into public.cash_flow_budget_periods(organization_id,year_number,month_number,
        opening_balance,sales_revenue,other_income,operating_costs,investments,loan_payments,created_by,updated_by)
      values(p_organization,p_year,n,case when n=1 then p_opening_balance else null end,
        (m->>'sales_revenue')::numeric,(m->>'other_income')::numeric,
        (m->>'operating_costs')::numeric,(m->>'investments')::numeric,
        (m->>'loan_payments')::numeric,auth.uid(),auth.uid())
      on conflict (organization_id,year_number,month_number) do nothing;
      if not found then raise exception using errcode='40001',message='Cash Flow Budget changed during save'; end if;
    else
      update public.cash_flow_budget_periods set
        opening_balance=case when n=1 then p_opening_balance else null end,
        sales_revenue=(m->>'sales_revenue')::numeric,other_income=(m->>'other_income')::numeric,
        operating_costs=(m->>'operating_costs')::numeric,investments=(m->>'investments')::numeric,
        loan_payments=(m->>'loan_payments')::numeric,updated_by=auth.uid()
      where organization_id=p_organization and year_number=p_year and month_number=n
        and edit_version=(m->>'expected_version')::bigint;
      if not found then raise exception using errcode='40001',message='Cash Flow Budget changed during save'; end if;
    end if;
  end loop;
  -- Text transport preserves every bigint digit in JavaScript clients.
  return jsonb_build_object('year',p_year,'months',(
    select jsonb_agg(jsonb_build_object(
      'month_number',month_number,'edit_version',edit_version::text
    ) order by month_number)
    from public.cash_flow_budget_periods
    where organization_id=p_organization and year_number=p_year
  ));
end; $$;
revoke all on function public.save_cash_flow_budget_year(uuid,integer,numeric,jsonb) from public,anon;
grant execute on function public.save_cash_flow_budget_year(uuid,integer,numeric,jsonb) to authenticated;
commit;
