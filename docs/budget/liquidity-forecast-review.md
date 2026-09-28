# Liquidity Forecast implementation and migration review

Local implementation only. No migrations applied, no existing migration edited,
no commit or push. The new route is `/budget/liquidity`, after Cash Flow Budget and
before Sales Budget & Forecast in the five-item Budget sidebar. Organization
switching recognizes this route. Global FI/PL/EN locale comes from the existing
server-readable cookie and is passed to the editor; no feature locale is created.

## Files changed

- `src/app/(authenticated)/budget/liquidity/page.tsx`
- `src/components/budget/liquidity-editor.tsx`
- `src/lib/budget/liquidity-model.ts`, `liquidity-service.ts`
- `src/app/actions/liquidity-forecast.ts`
- `src/lib/budget/saved-versions.ts`: shared lossless RPC response validator;
  `cash-flow-model.ts` re-exports the existing names for compatibility.
- `src/components/navigation/nav-config.ts`, `src/app/actions/organization-context.ts`
- `src/lib/i18n/app-ui.ts`, `docs/i18n/terminology.md`
- `supabase/migrations/20260926000000_liquidity_forecast.sql`
- `supabase/tests/liquidity_forecast.sql`
- `supabase/diagnostics/liquidity-forecast-role-preflight.sql`
- `tests/budget/liquidity.test.mjs`, `liquidity-editor.test.mjs`,
  `navigation.test.mjs`, `render.test.mjs`
- This review, `liquidity-forecast-import-notes.md` and central `implementation-review.md`.

## Model, authorization and concurrency

`public.liquidity_forecast_periods` is an independent organization/year/month dataset
with a unique constraint, UUID id, audit fields and BIGINT version. Years 2020–2100,
months 1–12. All five source inputs are nullable numeric(18,2), without zero defaults.
This follows the explicit NULL/zero preservation requirement over the suggested
NOT NULL defaults. Non-null values are below 10^12; only opening_balance can be
negative. Every month's opening is independently editable, including blank/zero.
EUR is the initial currency. No derived columns or automatic cross-domain sync.

All twelve months and versions are validated before writes. The RPC requires a
JSON array of twelve objects, all five keys, canonical decimals or explicit NULL.
An organization/year advisory lock serializes saves; expected versions are parsed
and compared as BIGINT. New rows require null versions, existing rows exact tokens.
INSERT conflict/UPDATE miss yields 40001. One atomic RPC returns all twelve current
versions as decimal strings in JSON; the editor updates tokens and its Cancel
baseline immediately, independently of router.refresh completion. The sequence is
owned by edit_version, supplies INSERT defaults, and the UPDATE-only trigger sets
new version and updated_at. Shared response validation preserves bigint precision.

FORCE RLS and authenticated SELECT only through is_organization_admin. No browser
DML or sequence access. SECURITY DEFINER RPC uses a safe search_path and explicitly
requires auth.uid and the existing organization helper. System Admin can use its
selected organization; Admin is tenant-scoped; Employee has no Budget access.
The server action checks selected organization equality as well. PUBLIC/anon
EXECUTE is revoked. The migration preflight requires SUPERUSER or BYPASSRLS on the
actual executing role, without granting either capability or hardcoding postgres.
Live role flags/RPC owner behavior are not verified: the pretty JSON read-only
preflight and disposable SQL tests are provided for deployment review.

## UI and calculations

Shared PageHeader, EmptyState, BudgetYearSelector, MetricCard, Card, Table, Input
and Button supply the established Budget editing style. Dashboard/inventory
reference files were inspected; both are empty. No new design tokens or visual
system. View/Edit/Save/Cancel, pending-disabled controls, accessible input labels,
error messages and horizontal table scrolling are provided. Year, organization
and canonical version changes remount the editor. Missing schema shows unavailable.

NULL displays empty; explicit zero displays 0.00 in the active locale. Missing form
fields and malformed numbers are errors, never implicitly zeroed. Calculations
coalesce NULL to zero without changing canonical inputs, using integer cents:

- Inflows = forecasted_sales + other_forecasted_income.
- Net = inflows - total_outflows.
- Closing = opening_balance + net, independently for each month.
- **Sales Needed is TOTAL required monthly sales**:
  max(0, minimum_required_balance - opening_balance - other_forecasted_income + total_outflows).
- Additional gap = max(0, Sales Needed - forecasted_sales); calculated by the model,
  not displayed as Sales Needed and not stored.

The supplied January 110074 and February 92063.81 examples each produce their own
closing values with blank opening/other inputs. February never accumulates January.
Annual totals sum forecasted sales, other income, inflows, outflows and net cash.
Opening/closing/minimum balances and sales requirements are blank in the total row,
with an explicit translated explanation. No misleading balance sums.

KPIs: annual forecasted sales, annual net cash, minimum monthly closing, first month
attaining that minimum, maximum monthly TOTAL sales requirement. Blank inputs are
zero only for calculations, so an entirely blank year has zero-derived KPIs and
an empty-data message. Minimum_required_balance NULL means unspecified in storage;
its calculation uses zero. No cascading or minimum propagation is assumed.

## Excel and terminology

Central Budget documentation now shows Cost Control → three independent tables.
Import is disabled. Structural signature and future preview rules are documented
in `liquidity-forecast-import-notes.md`; derived Excel fields are comparison-only.
Future MANUAL / SALES_FORECAST sources and scenario FORECAST integration are only
notes, with no synchronization or source enum implemented.

Added runtime keys: nav.liquidityForecast and liquidity.opening_balance,
forecasted_sales, other_forecasted_income, total_inflows, total_outflows,
net_cash_flow, closing_balance, minimum_required_balance, sales_needed,
lowest_closing_balance, lowest_balance_month, largest_sales_requirement,
salesDefinition, distinction, totalsNote, empty, unavailable and invalid.
All keys are translated in FI/PL/EN; canonical values remain language-independent.

## Verification and outstanding approval

`pnpm test:budget`: 42 passed, 2 opt-in database tests skipped.
`pnpm lint`, `pnpm exec tsc --noEmit --incremental false`, `pnpm build` and
`git diff --check` passed. Production build includes `/budget/liquidity`.

Focused tests cover the two source examples, non-chaining, formulas, total versus
additional sales, NULL/zero, negative balances, appropriate annual sums, first-min
KPI, malformed/missing input with zero writes, independent years, tenant/Employee
rejection, returned tokens and re-edit before refresh. SSR tests cover all three
locales and blank total cells. Existing shared authorization tests cover Admin and
System Admin access. SQL tests cover persistence, uniqueness, versions, malformed
JSON, all-month atomic validation, tenant boundaries and Employee denial.

SQL tests are prepared but not executed. No database deployment, actual concurrent
sessions or authenticated browser end-to-end save/hydration test was run. The new
migration requires review/approval and disposable Supabase verification before
production use. Annual and Cash Flow migrations remain untouched.

## Final migration cleanup

Only the three concurrency message texts were changed to Liquidity Forecast wording
(four occurrences: the during-save message covers both INSERT and UPDATE).
SQLSTATE 40001 and every other SQL statement remain unchanged. Independent nullable
monthly opening inputs remain distinct from Cash Flow Budget's derived chain.
No Sales Needed formula or derived-value column is implemented in this migration;
its business formula remains subject to separate source workbook verification.
Verification: an exact before/after comparison confirms only those message replacements;
`git diff --check` passes. No database execution, migration application, commit or push.
Application lint/type/build and 42 passing Budget tests were verified in the preceding
implementation turn; they were not rerun for this SQL-message-only cleanup.

## Full migration SQL

```sql
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
```
