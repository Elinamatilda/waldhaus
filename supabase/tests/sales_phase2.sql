-- INTEGRATION TEST: ONLY in a disposable Supabase database AFTER approved migration.
-- Not executed by Codex. Writes test data and rolls it back; never run in production.
-- Run as postgres. Assertion failure aborts; no application credentials are embedded.
begin;
do $$
declare
  u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  p uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); s uuid; a uuid; fc uuid;
  months jsonb; stale jsonb; fresh jsonb; bad jsonb; report jsonb; expected numeric;
  total integer; period uuid;
begin
  insert into auth.users(id,email) values(u,u::text||'@test.invalid');
  update public.profiles set is_system_admin=true,is_active=true where id=u;
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.organizations(id,name,slug) values(o,'Phase2 test',o::text);
  insert into public.customers(id,organization_id,name) values(c,o,'Test customer');
  insert into public.products(id,organization_id,name) values(p,o,'Test product');
  insert into public.product_variants(id,organization_id,product_id,customer_id,variant_name) values(v,o,p,c,'Test variant');
  select id into s from public.sales_scenarios where organization_id=o and code='BUDGET';
  select id into a from public.sales_scenarios where organization_id=o and code='ACTUAL';
  select id into fc from public.sales_scenarios where organization_id=o and code='FORECAST';
  select jsonb_agg(jsonb_build_object('month',n,'operation','save','expected_id',null,'expected_version',null,
    'quantity',2,'volume',1,'price',50,'revenue',null,'mode','CALCULATED','unit','PIECE','basis','PER_PIECE','currency','EUR') order by n)
    into months from generate_series(1,12) n;
  -- A/B: bad last month rolls back all, including newly created periods.
  bad:=jsonb_set(months,'{11,quantity}','"typo"');
  begin
    perform public.save_sales_year(o,s,2026,c,p,v,'planning',bad);
    raise exception 'FAILED: invalid month accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.sales_facts where organization_id=o) or exists(select 1 from public.sales_periods where organization_id=o) then
    raise exception 'FAILED: invalid submission mutated data';
  end if;
  -- H: wrong customer-specific variant must reject all months.
  update public.product_variants set customer_id=null where id=v;
  update public.product_variants set customer_id=c where id=v;
  declare other uuid:=gen_random_uuid(); begin
    insert into public.customers(id,organization_id,name) values(other,o,'Other');
    begin
      perform public.save_sales_year(o,s,2026,other,p,v,'planning',months);
      raise exception 'FAILED: incompatible variant accepted';
    exception when invalid_parameter_value then null; end;
  end;
  -- C: one call writes every intended month.
  perform public.save_sales_year(o,s,2026,c,p,v,'planning',months);
  select count(*) into total from public.sales_facts where organization_id=o;
  if total<>12 then raise exception 'FAILED: twelve-month save'; end if;
  -- E: replaying old empty-slot versions cannot overwrite the new records.
  begin
    perform public.save_sales_year(o,s,2026,c,p,v,'planning',months);
    raise exception 'FAILED: stale edit accepted';
  exception when serialization_failure then null; end;
  -- I: assignment of a referenced variant cannot change, even to generic.
  begin
    update public.product_variants set customer_id=null where id=v;
    raise exception 'FAILED: referenced variant assignment changed';
  exception when check_violation then null; end;
  select jsonb_agg((months->(sp.month_number-1)) || jsonb_build_object('expected_id',f.id,'expected_version',f.edit_version) order by sp.month_number)
    into fresh from public.sales_facts f join public.sales_periods sp on sp.id=f.period_id where f.organization_id=o;
  stale:=fresh;
  -- D: explicit deletion deletes January alone; remaining months explicitly kept.
  select jsonb_agg(value || jsonb_build_object('operation',case when ordinality=1 then 'delete' else 'keep' end) order by ordinality)
    into fresh from jsonb_array_elements(fresh) with ordinality;
  perform public.save_sales_year(o,s,2026,c,p,v,'planning',fresh);
  select count(*) into total from public.sales_facts where organization_id=o;
  if total<>11 then raise exception 'FAILED: explicit delete scope'; end if;
  begin
    perform public.save_sales_year(o,s,2026,c,p,v,'planning',stale);
    raise exception 'FAILED: stale deleted fact accepted';
  exception when serialization_failure then null; end;
  -- F: independent scenarios; no combined revenue value.
  perform public.save_sales_year(o,fc,2026,c,p,v,'planning',months);
  perform public.save_sales_year(o,a,2026,c,p,v,'actual',months);
  report:=public.sales_report(o,2026);
  if jsonb_array_length(report->'totals')<>3 then raise exception 'FAILED: scenario grouping'; end if;
  select (value->>'revenue')::numeric into expected from jsonb_array_elements(report->'totals') where value->>'scenario'='ACTUAL';
  if expected<>1200 then raise exception 'FAILED: actual total'; end if;
  -- G: over 1000 facts; SQL aggregation includes every fact and separates PLN.
  select id into period from public.sales_periods where organization_id=o and month_number=1 and year_number=2026;
  with new_customers as (
    insert into public.customers(organization_id,name)
    select o,'Bulk '||n from generate_series(1,1001) n returning id
  ) insert into public.sales_facts(organization_id,scenario_id,period_id,customer_id,product_id,revenue_amount,currency_code)
    select o,a,period,id,p,1,'PLN' from new_customers;
  report:=public.sales_report(o,2026);
  select (value->>'revenue')::numeric into expected from jsonb_array_elements(report->'totals') where value->>'scenario'='ACTUAL' and value->>'currency_code'='PLN';
  if expected<>1001 then raise exception 'FAILED: >1000 rows / currency separation'; end if;
  select (value->>'price')::numeric into expected from jsonb_array_elements(report->'prices')
    where value->>'scenario'='ACTUAL' and value->>'currency_code'='EUR' and value->>'pricing_basis_code'='PER_PIECE';
  if expected<>50 then raise exception 'FAILED: weighted price'; end if;
  if has_table_privilege('authenticated','public.sales_facts','INSERT')
    or has_table_privilege('authenticated','public.sales_facts','UPDATE')
    or has_table_privilege('authenticated','public.sales_facts','DELETE') then
    raise exception 'FAILED: direct fact writes still granted';
  end if;
  -- Caller without platform privilege or membership is denied.
  update public.profiles set is_system_admin=false where id=u;
  begin
    perform public.save_sales_year(o,s,2026,c,p,v,'planning',months);
    raise exception 'FAILED: non-admin mutation accepted';
  exception when insufficient_privilege then null; end;
  -- Active organization ADMIN can read its own report, not another organization.
  insert into public.organization_members(organization_id,user_id,role_id,is_active)
    select o,u,id,true from public.roles where code='ADMIN' and scope='ORGANIZATION';
  perform public.sales_report(o,2026);
  begin
    perform public.sales_report(gen_random_uuid(),2026);
    raise exception 'FAILED: cross-organization report accepted';
  exception when insufficient_privilege then null; end;
  update public.organization_members set role_id=(select id from public.roles where code='EMPLOYEE' and scope='ORGANIZATION')
    where organization_id=o and user_id=u;
  begin
    perform public.save_sales_year(o,s,2026,c,p,v,'planning',months);
    raise exception 'FAILED: employee mutation accepted';
  exception when insufficient_privilege then null; end;
end $$;
select jsonb_pretty(jsonb_build_object('result','passed','transaction','rolled back after test')) as report;
rollback;
