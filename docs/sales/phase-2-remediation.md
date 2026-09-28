# Sales Phase 2 — implementation and migration review

Status: the user reports applying Sales Phase 2 in Supabase. Their supplied catalog
report confirms the expected edit_version/revenue_mode columns and the Sales Phase 2
triggers on sales_facts. All four supplied function bodies match the local migration
after normalizing line endings: sales_fact_version, sales_variant_integrity,
save_sales_year and sales_report. No ALTER TABLE correction is required for these
compared objects. This report does not verify grants, all constraints, the variant
table trigger or the migration ledger. The agent performed no remote reset, schema
push, commit or git push. The five pre-existing migrations are unchanged.

The phase-2 request's audit findings, repository AGENTS.md, Sales domain documentation,
existing SQL and the supplied deployed catalog observation were used. A separate
repository-wide audit-result file is not present in the repository; the original
attachment is the audit request, not the completed findings. The Phase 1 missing
historical bootstrap/migration-ledger issue remains separate and unresolved.

## Changes and behavior

- `src/lib/sales/validation.ts`: EMPTY / VALID / INVALID parsing; years 2020–2100,
  UUID syntax, finite nonnegative decimals with at most six decimal places,
  allowed unit/basis/mode checks, and whole-year validation before RPC invocation.
- `src/app/(authenticated)/sales/actions.ts`: monthly network mutation loop and
  inferred deletion removed. One `save_sales_year` call; structured validation,
  conflict, forbidden, missing-record and database errors. Master-data mutations
  return structured errors too. Diagnostic database errors remain server-side.
  System Admin mutations must match the selected server organization context.
- `src/components/sales/monthly-facts-grid.tsx`: carries fact ID and edit version;
  explicit per-month deletion and a separate confirmation checkbox. Empty fields
  preserve facts. MANUAL versus CALCULATED revenue is visible. Inputs remain on
  validation failure and submit controls are disabled while saving.
- Planning/Actuals pages: pass versions/modes, validate selected active master data
  and filter customer-incompatible variants; refresh the form when scope/version changes.
- `src/lib/sales/service.ts`: read-only period lookup, explicit composite FK for
  the remaining planning embed, SQL-report RPC rather than raw fact aggregation,
  deterministic master-data pagination. Customers/products list pages request
  200-row pages; selection lists fetch consecutive 200-row batches. Variants are
  also fetched in ordered 200-row batches. Large selection lists remain a future UX concern.
- Customers/products list pages: creation managers stay mounted for an empty
  organization and zero search matches; only the result region shows the empty state.
- `src/components/sales/mutation-form.tsx` and both managers: keep dialogs open
  on errors, show structured messages, prevent duplicate in-flight submissions.
- `src/components/sales/report.tsx` and overview/customer/product pages: one shared
  reporting presentation, separated by scenario and currency. Business names and
  notes/descriptions remain unchanged. Detail status and description are retained.
- `src/lib/sales/search-params.ts`: list-page parameter.
- `package.json`: `pnpm test:sales` command.

## Database contracts

`20260925210000_sales_phase2_integrity.sql` adds:

1. `sales_edit_version_seq`, `sales_facts.edit_version` (text), and
   `sales_facts.revenue_mode`. Existing amounts become explicitly MANUAL; they are
   not recalculated or relabelled as derived revenue.
2. `sales_fact_version()` trigger: generates a fresh monotonic token on every
   fact insert/update, including privileged writes. Sequence gaps on transaction
   rollback are expected; tokens are identities, not counters exposed as quantities.
3. `sales_variant_integrity()` triggers: lock the referenced variant on fact writes,
   validate tenant/product/customer compatibility, and forbid customer reassignment
   of a referenced variant. No existing FK is removed.
4. `save_sales_year(...)`: authorizes the caller, serializes saves per organization
   with a transaction advisory lock, locks referenced active master rows, validates
   all 12 month operations and expected fact ID/version pairs before fact writes.
   Any error rolls back the whole RPC. A stale insert/update/delete raises `40001`;
   the application reports CONFLICT and does not retry overwrites automatically.
   Periods are created only for saved months using `ON CONFLICT DO NOTHING`.
5. `sales_report(...)`: one scalar JSON result aggregated in PostgreSQL, before
   PostgREST max_rows. Overview and both detail reports share this function with
   optional customer/product filters. It does not write periods or facts.

Empty operation = keep; explicit delete = delete that expected fact only. An empty
new month stays absent. A partially filled month must resolve to MANUAL revenue or
CALCULATED revenue with matching price and denominator, otherwise the save fails.
CALCULATED ignores the old revenue input and recalculates in PostgreSQL decimal
arithmetic. MANUAL is an explicit override, including revenue-only facts.

Optimistic concurrency is scoped to monthly sales facts. Master-data edit dialogs
retain their existing last-writer behavior; this is not a collaborative editing system.
Serialization is intentionally coarse (one organization at a time), not a new cache.

## Reporting rules

BUDGET, FORECAST and ACTUAL are separate grouping dimensions in all metrics,
monthly rows and customer/product totals. No generic combined revenue is returned.
Currency is another grouping dimension and is displayed from the returned code;
there is no hardcoded EUR aggregate, currency conversion, or invented exchange rate.
Entities group by UUID, never just their names.

Weighted prices are separated by scenario, currency and pricing basis. Only
CALCULATED facts with a positive compatible denominator contribute:
PER_PIECE = matching revenue / piece quantity;
PER_M3 = matching revenue / volume. Manual overrides and historical MANUAL rows
are excluded, rather than presenting their amounts as inferred unit prices.

## Security review

| Function | Security | Caller / boundary |
| --- | --- | --- |
| save_sales_year | DEFINER, explicit pg_catalog/pg_temp search_path; schema-qualified application objects | Requires non-null auth.uid and is_organization_admin(selected organization), which includes active System Admin. Active organization ADMIN only in own organization; Employee denied. Validates all referenced records again in DB. PUBLIC/anon execution revoked, authenticated granted. |
| sales_report | INVOKER, explicit search_path | Same explicit admin check and existing table RLS; no bypass of RLS, returns only requested organization's aggregates. PUBLIC/anon execution revoked. |
| sales_fact_version | DEFINER trigger only, explicit search_path | No callable business RPC; PUBLIC/anon/authenticated execute and sequence access revoked. |
| sales_variant_integrity | DEFINER trigger only, explicit search_path | Reads referenced facts without allowing RLS to hide a conflicting fact; no direct grants. Locks variant rows to serialize assignment and fact writes. |

Direct authenticated/anonymous INSERT/UPDATE/DELETE on sales_facts is revoked so
interactive writers cannot bypass the RPC's concurrency contract. Existing RLS is
retained. Trusted service-role/owner maintenance remains privileged and must not
be exposed to the browser. No service-role credentials were introduced.

## Verification and limits

- Local Node suite: 80 tests passed (68 existing auth/context + 12 Sales tests).
- Lint and standalone TypeScript check passed.
- Production build passed (final build result recorded after completion).
- Local tests cover malformed input, late invalid month with zero RPC calls,
  one 12-month RPC call, explicit deletion, stale error mapping, read-only periods,
  explicit FK embed, aggregated RPC scope, and creation UI with empty results.
- `supabase/tests/sales_phase2.sql` is an **unexecuted** transaction/rollback test
  for a disposable Supabase database after approved deployment. It covers invalid
  submission rollback, 12-month persistence, explicit delete, stale saves,
  customer-specific variants, referenced assignment protection, scenario/currency
  separation, 1001 extra facts, weighted price and basic role authorization.
- No PostgreSQL server/CLI or authenticated browser session was available. No live
  route smoke tests, database migration execution, real rollback tests, actual
  simultaneous-connection races or live RLS tests were run. Mock tests do not prove
  these behaviors. Run SQL tests and two-session concurrent saves before production.

Read-only preflight: `supabase/diagnostics/sales-phase2-preflight.sql` returns one
pretty JSON report; it does not mutate data or repair migration history. Review
existing column grants, custom currency/unit values and any negative revenue first.

## Business decisions / deployment review still required

- No per-linear-meter price basis or length-to-piece conversion is invented.
  LINEAR_METER can carry volume-based pricing or explicit manual revenue.
- Credit notes/negative revenue are not specified by current Sales planning docs.
  New form inputs currently require nonnegative amounts; existing negative facts
  are preserved and reported, but need a confirmed correction workflow before editing.
- No ISO currency registry is present: three uppercase letters are validated as
  the existing code contract, not as proof of a current ISO-4217 currency. Unknown
  historical codes are still displayed without assuming EUR.
- Piece integer-only rules and automatic volume derivation remain undefined;
  no conversion from dimensions/legacy measurements is introduced.
- Review the new RPC, trigger locks, direct-write grant revocation, and historical
  MANUAL mode before applying. Run the preflight, disposable database suite and
  two-session race/tenant tests, then deploy migration and code together.
- The migration is not an invented historical baseline and cannot repair the
  missing initial organization migration chain identified in Phase 1.

## Full migration SQL (verbatim)

```sql
-- REVIEW ONLY. Do not apply without approval. Existing migrations are immutable.
begin;

-- A monotonically increasing token avoids timestamp precision and same-transaction ABA.
create sequence public.sales_edit_version_seq;
alter table public.sales_facts
  add column edit_version text not null default nextval('public.sales_edit_version_seq')::text,
  add column revenue_mode text not null default 'MANUAL'
    check (revenue_mode in ('MANUAL', 'CALCULATED'));

create function public.sales_fact_version() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  new.edit_version := nextval('public.sales_edit_version_seq')::text;
  return new;
end $$;
create trigger sales_fact_version before insert or update on public.sales_facts
for each row execute function public.sales_fact_version();
revoke all on function public.sales_fact_version() from public, anon, authenticated;
revoke all on sequence public.sales_edit_version_seq from public, anon, authenticated;

-- Lock the same variant row from both directions to close the assignment/write race.
create function public.sales_variant_integrity() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v public.product_variants%rowtype;
begin
  if tg_table_name = 'product_variants' then
    if new.customer_id is distinct from old.customer_id and exists (
      select 1 from public.sales_facts f where f.product_variant_id = old.id
    ) then raise exception using errcode='23514', message='Referenced variant assignment cannot change'; end if;
    return new;
  end if;
  if new.product_variant_id is not null then
    select * into v from public.product_variants where id = new.product_variant_id for update;
    if not found or v.organization_id <> new.organization_id or v.product_id <> new.product_id
       or (v.customer_id is not null and v.customer_id <> new.customer_id) then
      raise exception using errcode='23514', message='Invalid variant relationship';
    end if;
  end if;
  return new;
end $$;
create trigger sales_variant_assignment_guard before update of customer_id on public.product_variants
for each row execute function public.sales_variant_integrity();
create trigger sales_fact_variant_guard before insert or update on public.sales_facts
for each row execute function public.sales_variant_integrity();
revoke all on function public.sales_variant_integrity() from public, anon, authenticated;

create function public.save_sales_year(
  p_organization uuid, p_scenario uuid, p_year integer, p_customer uuid,
  p_product uuid, p_variant uuid, p_mode text, p_months jsonb
) returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  m jsonb; f public.sales_facts%rowtype; v public.product_variants%rowtype;
  scenario_code text; period uuid; n integer; q numeric; vol numeric; price numeric; revenue numeric;
  basis text; unit_code text; currency text; mode text; op text;
begin
  if auth.uid() is null or not public.is_organization_admin(p_organization) then
    raise exception using errcode='42501', message='Forbidden';
  end if;
  if p_year is null or p_year not between 2020 and 2100 or p_mode is null or p_mode not in ('planning','actual')
    or jsonb_typeof(p_months) is distinct from 'array' then
    raise exception using errcode='22023', message='Invalid annual submission';
  end if;
  if jsonb_array_length(p_months) <> 12 then raise exception using errcode='22023', message='Twelve months required'; end if;
  -- Serialize RPC saves per organization, including insert-vs-insert and empty slots.
  perform pg_advisory_xact_lock(hashtextextended(p_organization::text, 78211));
  select code into scenario_code from public.sales_scenarios
    where id=p_scenario and organization_id=p_organization and is_active for share;
  if not found or (p_mode='planning' and scenario_code not in ('BUDGET','FORECAST'))
    or (p_mode='actual' and scenario_code <> 'ACTUAL') then
    raise exception using errcode='22023', message='Invalid scenario';
  end if;
  perform 1 from public.customers where id=p_customer and organization_id=p_organization and is_active for share;
  if not found then raise exception using errcode='P0002', message='Customer unavailable'; end if;
  perform 1 from public.products where id=p_product and organization_id=p_organization and is_active for share;
  if not found then raise exception using errcode='P0002', message='Product unavailable'; end if;
  if p_variant is not null then
    select * into v from public.product_variants where id=p_variant for update;
    if not found or not v.is_active or v.organization_id<>p_organization or v.product_id<>p_product
      or (v.customer_id is not null and v.customer_id<>p_customer) then
      raise exception using errcode='22023', message='Variant unavailable or incompatible';
    end if;
  end if;
  -- First pass: validate every month and every expected version BEFORE any write.
  for n in 1..12 loop
    m := p_months->(n-1);
    if (m->>'month') is distinct from n::text or m->>'operation' is null
      or m->>'operation' not in ('keep','delete','save') then
      raise exception using errcode='22023', message='Invalid month operation';
    end if;
    select sf.* into f from public.sales_facts sf join public.sales_periods sp
      on sp.id=sf.period_id and sp.organization_id=sf.organization_id
      where sf.organization_id=p_organization and sf.scenario_id=p_scenario
        and sf.customer_id=p_customer and sf.product_id=p_product
        and sf.product_variant_id is not distinct from p_variant
        and sp.year_number=p_year and sp.month_number=n for update of sf;
    if f.id::text is distinct from (m->>'expected_id') or f.edit_version is distinct from (m->>'expected_version') then
      raise exception using errcode='40001', message='Stale sales edit';
    end if;
    op := m->>'operation';
    if op='delete' and f.id is null then raise exception using errcode='22023', message='No fact to delete'; end if;
    if op <> 'save' then continue; end if;
    foreach mode in array array['quantity','volume','price','revenue'] loop
      if m->>mode is not null and (m->>mode !~ '^\d+(\.\d{1,6})?$' or length(m->>mode)>24) then
        raise exception using errcode='22023', message='Invalid numeric value';
      end if;
    end loop;
    q := (m->>'quantity')::numeric; vol := (m->>'volume')::numeric; price := (m->>'price')::numeric;
    revenue := (m->>'revenue')::numeric; basis := m->>'basis'; unit_code := m->>'unit'; currency := m->>'currency'; mode := m->>'mode';
    if unit_code is null or unit_code not in ('PIECE','LINEAR_METER') or currency is null or currency !~ '^[A-Z]{3}$'
      or (basis is not null and basis not in ('PER_PIECE','PER_M3')) or (basis='PER_PIECE' and unit_code<>'PIECE')
      or mode is null or mode not in ('MANUAL','CALCULATED')
      or greatest(q,vol,price,revenue) >= 1e12 then
      raise exception using errcode='22023', message='Invalid units, currency or revenue mode';
    end if;
    if mode='CALCULATED' then
      if price is null or basis is null or (basis='PER_PIECE' and q is null) or (basis='PER_M3' and vol is null) then
        raise exception using errcode='22023', message='Incomplete calculated revenue';
      end if;
      revenue := round(price * case when basis='PER_PIECE' then q else vol end, 2);
    elsif revenue is null then raise exception using errcode='22023', message='Manual revenue required'; end if;
    if revenue >= 1e16 then raise exception using errcode='22023', message='Revenue out of range'; end if;
  end loop;
  -- Second pass: all mutations are in this single transaction; any error rolls back all.
  for n in 1..12 loop
    m := p_months->(n-1); op := m->>'operation';
    if op='keep' then continue; end if;
    if op='delete' then
      delete from public.sales_facts where id=(m->>'expected_id')::uuid and organization_id=p_organization;
      continue;
    end if;
    insert into public.sales_periods(organization_id,period_start,year_number,month_number)
      values(p_organization,make_date(p_year,n,1),p_year,n)
      on conflict (organization_id,period_start) do nothing;
    select id into period from public.sales_periods where organization_id=p_organization and period_start=make_date(p_year,n,1);
    q := (m->>'quantity')::numeric; vol := (m->>'volume')::numeric; price := (m->>'price')::numeric;
    basis := m->>'basis'; mode := m->>'mode';
    revenue := case when mode='MANUAL' then (m->>'revenue')::numeric
      else round(price * case when basis='PER_PIECE' then q else vol end,2) end;
    if m->>'expected_id' is not null then
      update public.sales_facts set quantity_value=q,volume_m3=vol,unit_price_amount=price,
        quantity_unit_code=m->>'unit',pricing_basis_code=basis,revenue_amount=revenue,
        revenue_mode=mode,currency_code=m->>'currency',updated_by=auth.uid()
        where id=(m->>'expected_id')::uuid and organization_id=p_organization;
    else
      insert into public.sales_facts(organization_id,scenario_id,period_id,customer_id,product_id,product_variant_id,
        quantity_value,quantity_unit_code,volume_m3,unit_price_amount,pricing_basis_code,revenue_amount,currency_code,revenue_mode,created_by,updated_by)
      values(p_organization,p_scenario,period,p_customer,p_product,p_variant,q,m->>'unit',vol,price,basis,revenue,m->>'currency',mode,auth.uid(),auth.uid());
    end if;
  end loop;
end $$;
revoke all on function public.save_sales_year(uuid,uuid,integer,uuid,uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.save_sales_year(uuid,uuid,integer,uuid,uuid,uuid,text,jsonb) to authenticated;
-- All interactive fact writes now require the concurrency-checked RPC. RLS is retained.
revoke insert, update, delete on public.sales_facts from authenticated, anon;

-- Aggregate before PostgREST row limits. One scalar JSON object, grouped by scenario
-- and currency. No FX conversion and no cross-basis arithmetic price average.
create function public.sales_report(p_organization uuid, p_year integer, p_customer uuid default null, p_product uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_organization_admin(p_organization) then
    raise exception using errcode='42501',message='Forbidden';
  end if;
  if p_year is null or p_year not between 2020 and 2100 then raise exception using errcode='22023',message='Invalid year'; end if;
  with facts as (
    select f.*,s.code scenario,p.month_number,c.name customer_name,pr.name product_name
    from public.sales_facts f
    join public.sales_periods p on (p.organization_id,p.id)=(f.organization_id,f.period_id)
    join public.sales_scenarios s on (s.organization_id,s.id)=(f.organization_id,f.scenario_id)
    join public.customers c on (c.organization_id,c.id)=(f.organization_id,f.customer_id)
    join public.products pr on (pr.organization_id,pr.id)=(f.organization_id,f.product_id)
    where f.organization_id=p_organization and p.year_number=p_year
      and (p_customer is null or f.customer_id=p_customer) and (p_product is null or f.product_id=p_product)
  ), totals as (
    select scenario,currency_code,sum(revenue_amount) revenue,sum(coalesce(volume_m3,0)) volume
    from facts group by scenario,currency_code
  ), months as (
    select scenario,currency_code,month_number,sum(revenue_amount) revenue from facts group by scenario,currency_code,month_number
  ), prices as (
    select scenario,currency_code,pricing_basis_code,
      sum(revenue_amount)/nullif(sum(case when pricing_basis_code='PER_PIECE' then quantity_value else volume_m3 end),0) price
    from facts where revenue_mode='CALCULATED' and
      ((pricing_basis_code='PER_PIECE' and quantity_unit_code='PIECE' and quantity_value>0) or (pricing_basis_code='PER_M3' and volume_m3>0))
    group by scenario,currency_code,pricing_basis_code
  ), customers as (
    select scenario,currency_code,customer_id,customer_name,sum(revenue_amount) revenue from facts group by scenario,currency_code,customer_id,customer_name
  ), products as (
    select scenario,currency_code,product_id,product_name,sum(revenue_amount) revenue from facts group by scenario,currency_code,product_id,product_name
  ) select jsonb_build_object(
    'totals',coalesce((select jsonb_agg(to_jsonb(t) order by scenario,currency_code) from totals t),'[]'::jsonb),
    'months',coalesce((select jsonb_agg(to_jsonb(m) order by scenario,currency_code,month_number) from months m),'[]'::jsonb),
    'prices',coalesce((select jsonb_agg(to_jsonb(p) order by scenario,currency_code,pricing_basis_code) from prices p),'[]'::jsonb),
    'customers',coalesce((select jsonb_agg(to_jsonb(c) order by scenario,currency_code,customer_id) from customers c),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(to_jsonb(p) order by scenario,currency_code,product_id) from products p),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.sales_report(uuid,integer,uuid,uuid) from public, anon;
grant execute on function public.sales_report(uuid,integer,uuid,uuid) to authenticated;
commit;
```
