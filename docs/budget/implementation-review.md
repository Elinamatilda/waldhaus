# Budget module — implementation and migration review

The implementation is local. **No migration was applied.** No old migration was
edited, no remote reset/schema push was run, and no commit/push was made.

## Cost Control worksheet datasets

```text
Cost Control worksheet
├── Annual Budget       /budget/annual
├── Cash Flow Budget    /budget/cash-flow
└── Liquidity Forecast  /budget/liquidity
```

These are separate canonical datasets. Future Excel import must detect all three
tables independently by their headers, not treat the worksheet as one table.
Liquidity openings are independent optional monthly inputs, unlike Cash Flow's
January-only persisted opening and derived chain. See `liquidity-forecast-import-notes.md`.
The sidebar now includes Liquidity Forecast after Cash Flow Budget and before
Sales Budget & Forecast. Earlier sections below describe the initial Budget work.

## Navigation and routing

The sidebar now has Overview, Operations, Sales, Budget, Management and System
sections. Sales contains Overview, Customers, Products and Actuals. Budget contains
Overview (`/budget`), Annual Budget (`/budget/annual`) and Sales Budget & Forecast
(`/budget/sales`). The Purchasing route remains intact but its former Commercial
sidebar section is removed to match the requested structure.

The planning implementation was **moved**, not cloned, from `/sales/planning` to
`/budget/sales`. The old page redirects while preserving the year/scenario/customer/
product/variant query fields; organization context remains the validated cookie.
The existing Sales actions are reused with cache revalidation for the new path.
There are no new Sales fact calculations or writes in this task. Budget routes
were added to the organization-switch return-path allowlist.

## Annual model and security

New migration: `supabase/migrations/20260925220000_annual_budget.sql`.
The new `annual_budget_periods` table stores organization, year, month, nine inputs,
creation/update audit fields and a bigint optimistic edit token. One row is allowed per
organization/year/month. Years are 2020–2100; months are 1–12. Source inputs are nullable: NULL means no value entered and 0 means explicitly budgeted zero. Non-null inputs are nonnegative;
money has two decimal places and production has six. Each input is below 10^12.
All money is explicitly EUR in this initial annual-budget contract. The table
comment and UI state this; it is not inferred from the selected language.

There are no stored derived totals, margins, source enums, customer/product links
or dependencies on `sales_facts`. The Annual Budget migration does not depend on
the unapplied Sales Phase 2 migration; the reused sales-planning workflow still does.
Both depend on the deployed organization/auth foundation documented in Phase 1.

RLS is enabled and forced. Authenticated SELECT requires the existing active
organization-admin helper (which includes active System Admin). Employees cannot
read/manage Annual Budget. Direct browser INSERT/UPDATE/DELETE is not granted.
`save_annual_budget_year` checks auth.uid and organization authorization independently
of the UI and uses a secure explicit search_path with qualified application tables.
PUBLIC and anon execution is revoked; only authenticated callers receive EXECUTE.
The application additionally requires the submitted organization to equal the
resolved selected organization. System Admin needs no membership; ordinary Admin
uses its authorized organization context.

The version trigger is not exposed as an RPC and its function/sequence privileges
are revoked from public/anon/authenticated. The supplied schema observation names postgres as the owner of existing auth
functions, but does not contain its SUPERUSER/BYPASSRLS flags. The revised migration
explicitly requires current_user=postgres and verifies one of those flags in
pg_roles **before any DDL**. PostgreSQL SUPERUSER/BYPASSRLS bypasses FORCE RLS; the
DEFINER RPC executes as that verified owner while auth.uid remains the JWT user.
Its explicit organization authorization therefore remains mandatory. If the
preflight fails, no objects are created and no privileges are elevated. Do not
remove the check: review a dedicated owner/owner-only write-policy design instead.
This is a deterministic deployment condition, not a claim that the live role flags
or RPC writes have already been tested. Run the read-only role preflight first. No service-role credential is used by the browser or app.

## UI, manual edits and calculations

Shared design-system components are reused: PageHeader, Card, MetricCard, Button,
Select, FormField, Input and Table. The dashboard and inventory reference files
were inspected and are empty; established application components supply the styling.
The wide table has horizontal overflow for smaller screens.

- Twelve translated month rows and one annual-total row.
- View mode shows locale-formatted amounts; edit mode exposes only input fields.
- Controlled input state keeps edits on validation/save errors. Cancel restores the
  server values without writing. Blank manual input explicitly means NULL, while an entered 0 remains zero; neither deletes the row.
- Save parses all nine fields for all 12 months before a single RPC call. Malformed,
  negative or excessive-precision input blocks persistence. No delete operation exists.
- The RPC independently validates all months and compares all edit versions before
  writes. An organization/year advisory lock serializes concurrent saves, including
  first inserts. Conflicts return a structured result instead of overwriting.
- Each successful call creates/updates all 12 rows atomically. Existing created_by
  is preserved on update. Viewing a year does not create any database records.
- Year selection uses `?year=`; org/year/version keys reset the editor to its correct
  server snapshot. Organization switching clears stale query state, as elsewhere.

Formulas in `src/lib/budget/model.ts`:

- Total cost = sum of the seven cost inputs.
- Cost/m³ = total cost / production, only when production > 0.
- Margin amount = sales minus total costs.
- Margin percent = margin / sales × 100, only when sales > 0.

Undefined ratios display an em dash. Negative derived margins remain visible.
Year totals sum the inputs and then recalculate rates/percentages; monthly ratios
are never summed or averaged. Monetary sums use integer cents to reduce fractional
addition errors; no derived values are written to PostgreSQL.

## Global localization

No locale state or cookie was added. All Budget keys were added to the existing
`src/lib/i18n/app-ui.ts` catalogue and use the server-resolved `waldhaus-locale`
cookie (`fi`, `pl`, `en`, default `fi`). Month names use Intl with an explicit UTC
month reference. Initial client locale is the same prop used on the server.

Required keys: nav.budget, nav.budgetOverview, nav.annualBudget,
nav.salesBudgetForecast. Added nav.overview and budget.* keys cover every new input,
derived value, action, year selector, placeholder and structured error message.
There was no existing global terminology document to update.

| Concept | FI | PL | EN |
| --- | --- | --- | --- |
| Module | Budjetti | Budżet | Budget |
| Annual view | Vuosibudjetti | Budżet roczny | Annual Budget |
| Sales planning | Myyntibudjetti & ennuste | Budżet sprzedaży i prognoza | Sales Budget & Forecast |
| Raw material | Raaka-ainekustannukset | Koszty surowców | Raw Material Costs |
| Energy | Energiakustannukset | Koszty energii | Energy Costs |
| Labor | Työkustannukset | Koszty pracy | Labor Costs |
| Maintenance | Huolto & korjaukset | Konserwacja i naprawy | Maintenance & Repairs |
| Transport | Kuljetus & logistiikka | Transport i logistyka | Transportation & Logistics |
| Administration | Hallinto & myynti | Administracja i sprzedaż | Administration & Sales |
| Waste | Jäte & ympäristö | Odpady i koszty środowiskowe | Waste & Environmental Costs |
| Total costs | Kulut yhteensä | Koszty razem | Total Costs |
| Production | Tuotanto | Produkcja | Production |
| Cost rate | Kustannus / m³ | Koszt / m³ | Cost per m³ |
| Margin | Kate | Marża | Profit Margin |
| Margin % | Kate % | Marża % | Profit Margin % |

## Files added/changed for this task

- `src/app/(authenticated)/budget/{layout,page}.tsx`
- `src/app/(authenticated)/budget/{annual,sales}/page.tsx`
- `src/app/(authenticated)/sales/planning/page.tsx` (compatibility redirect)
- `src/app/(authenticated)/sales/actions.ts` (route invalidation only this task)
- `src/app/actions/{annual-budget,organization-context}.ts`
- `src/components/budget/{annual-editor,screen,year-selector}.tsx`
- `src/components/navigation/nav-config.ts`
- `src/lib/budget/{model,service}.ts`
- `src/lib/i18n/app-ui.ts`
- `package.json` (`pnpm test:budget`)
- `tests/budget/{model,actions,navigation,render}.test.mjs`, `fixture.mjs`
- `supabase/tests/annual_budget.sql`
- the new migration and both `docs/budget` documents.

Earlier uncommitted remediation/localization changes remain in the workspace and
are not reclassified as new Budget work.

## Verification / blockers / approval

Before the review corrections, the combined Node suite passed 94 tests: 80 prior tests and 14 Budget tests.
Budget tests cover calculations, yearly ratios, zero denominators, malformed input,
zero mutation calls on invalid input, one 12-month call, selected organization,
Employee rejection, conflicts, navigation reuse and SSR rendering in FI/PL/EN.

Production build passed and lists all three new Budget routes. Standalone TypeScript
passed after regenerating Next's stale route declarations with `next typegen` and
replacing an ES2020 BigInt literal with the constructor compatible with the repo's
TypeScript target. No type checks were disabled. Final lint passed after correcting a test fixture's missing React display name.

`supabase/tests/annual_budget.sql` contains rollback-only integration tests for
2025/2026/2027, uniqueness, invalid months, negative costs, late malformed input,
conflicts, System Admin, own-organization Admin and Employee restrictions.
**These PostgreSQL tests were not run:** no database connection/server is available,
and the migration must not be applied without review. Local mock/SSR tests do not
prove real RLS, transaction rollback, two-session concurrency, browser hydration or
an authenticated end-to-end save. Those are required after approved test deployment.

Review the full migration below, then test it in an approved disposable Supabase
environment before production. The Annual Budget UI deliberately shows unavailable
when the table is absent. Excel import remains disabled by design. The existing
Sales Phase 2 migration must also be reviewed/applied before `/budget/sales` can use
its save/report dependencies. No remote changes are authorized or performed here.


## Annual Budget review corrections

This unexecuted draft migration was revised in place at the user's request; no
applied migration was edited. The Cash Flow work is paused and its unfinished
route is not advertised in navigation.

- All nine canonical input columns are nullable with explicit null-or-range checks.
- Blank cells display empty; explicit zeros remain visible. NULL is coalesced only
  for calculations, not persisted as zero.
- edit_version is PostgreSQL bigint, assigned by default on insert and an UPDATE-only
  trigger on update. Inserts and updates use separate RPC branches to avoid consuming
  an insert default on an existing-row update.
- Versions travel as decimal strings in JSON/form fields to avoid JavaScript's
  53-bit number limit. Reads explicitly cast the bigint to text for transport.
  The database parses the supplied value into bigint and compares numerically.
- Existing rows require a matching version; absent/stale values return 40001. New
  rows require null/missing version. Malformed/out-of-range versions return 22023.
  Empty string becomes null only at the application form boundary; the RPC rejects it.
- A complete JSON key set is required for the nine inputs; JSON null is valid,
  while missing keys/invalid numeric text fail before writes.
- The same organization/year transaction lock and atomic 12-month save remain.

The revised SQL test covers NULL/zero persistence, matching updates, stale versions,
late invalid-month rollback and version format/range checks. A separate opt-in
`tests/budget/annual-concurrency.integration.test.mjs` sends two concurrent requests
from independent clients against one previously empty year. It expects one complete
winner and one 40001 conflict. It is SKIPPED unless explicitly enabled against an
approved disposable project. It never applies migrations and deliberately refuses
an existing year. Configure RUN_DISPOSABLE_BUDGET_TEST=1, BUDGET_TEST_URL,
BUDGET_TEST_ANON_KEY, BUDGET_TEST_ADMIN_JWT, BUDGET_TEST_ORGANIZATION and BUDGET_TEST_YEAR
only for that disposable test. The 12 fixture rows remain there for inspection.

Live PostgreSQL tests, true concurrency and FORCE RLS behavior remain unverified.
The read-only `supabase/diagnostics/annual-budget-role-preflight.sql` returns one
pretty JSON report with actual role flags and owners; it has not been run remotely.

Verification after these corrections: `pnpm test:budget` passed 19 tests with one
database concurrency test skipped. `pnpm lint`, `pnpm build` and standalone
`pnpm exec tsc --noEmit --incremental false` passed. The standalone type check was
rerun after the build completed: running them concurrently initially encountered
a transient missing generated `.next/types/routes.js` file. `git diff --check`
passed. The full combined suite was not rerun for this revision. No migration was
applied, and no commit or push was made.

Security references: [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
confirms that SUPERUSER/BYPASSRLS bypasses row security even when FORCE RLS subjects
ordinary table owners to it. [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html)
defines SECURITY DEFINER execution using the function owner's privileges. These
confirm PostgreSQL semantics, not the unqueried live Supabase role attributes.

## Full migration SQL (verbatim)

```sql
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
```
