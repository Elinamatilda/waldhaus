-- Review/test artifact only. Run in a DISPOSABLE Supabase DB after approved migration.
-- No migrations are applied by this test. Test data is rolled back.
begin;
do $$
declare
  u uuid:=gen_random_uuid(); org_a uuid:=gen_random_uuid(); org_b uuid:=gen_random_uuid();
  months jsonb; bad jsonb; fresh jsonb; stale jsonb; year integer; count_rows integer; before_version bigint;
begin
  insert into auth.users(id,email) values(u,u::text||'@test.invalid');
  update public.profiles set is_active=true,is_system_admin=true where id=u;
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.organizations(id,name,slug) values(org_a,'Budget A',org_a::text),(org_b,'Budget B',org_b::text);
  select jsonb_agg(jsonb_build_object('month_number',n,'expected_version',null,
    'sales_amount',1000,'raw_material_cost',100,'energy_cost',100,'labor_cost',100,
    'maintenance_repairs_cost',100,'transportation_logistics_cost',100,'administration_sales_cost',100,
    'waste_environmental_cost',100,'production_m3',10) order by n)
  into months from generate_series(1,12) n;
  months:=jsonb_set(months,'{0,sales_amount}','null');
  months:=jsonb_set(months,'{1,sales_amount}','0');
  -- System Admin has no membership; explicitly scoped RPC creates 12 rows per year.
  execute 'set local role authenticated';
  foreach year in array array[2025,2026,2027] loop
    perform public.save_annual_budget_year(org_a,year,months);
  end loop;
  select count(*) into count_rows from public.annual_budget_periods where organization_id=org_a;
  if count_rows<>36 then raise exception 'FAILED: multiple years'; end if;
  begin
    perform public.save_annual_budget_year(org_a,2026,months);
    raise exception 'FAILED: stale empty versions accepted';
  exception when serialization_failure then null; end;
  if (select sales_amount from public.annual_budget_periods where organization_id=org_a and year_number=2026 and month_number=1) is not null then
    raise exception 'FAILED: blank was not preserved as NULL';
  end if;
  if (select sales_amount from public.annual_budget_periods where organization_id=org_a and year_number=2026 and month_number=2) is distinct from 0::numeric then
    raise exception 'FAILED: explicit zero changed';
  end if;
  select jsonb_agg((months->(month_number-1)) || jsonb_build_object('expected_version',edit_version) order by month_number)
    into fresh from public.annual_budget_periods where organization_id=org_a and year_number=2026;
  stale:=fresh;
  select max(edit_version) into before_version from public.annual_budget_periods where organization_id=org_a and year_number=2026;
  -- Valid current versions update all twelve; NULL stays NULL and zero stays zero.
  perform public.save_annual_budget_year(org_a,2026,fresh);
  if (select min(edit_version) from public.annual_budget_periods where organization_id=org_a and year_number=2026)<=before_version then
    raise exception 'FAILED: version did not advance';
  end if;
  begin
    perform public.save_annual_budget_year(org_a,2026,stale);
    raise exception 'FAILED: stale non-null versions accepted';
  exception when serialization_failure then null; end;
  select jsonb_agg((months->(month_number-1)) || jsonb_build_object('expected_version',edit_version) order by month_number)
    into fresh from public.annual_budget_periods where organization_id=org_a and year_number=2026;
  select max(edit_version) into before_version from public.annual_budget_periods where organization_id=org_a and year_number=2026;
  bad:=jsonb_set(fresh,'{11,energy_cost}','"wrong"');
  begin
    perform public.save_annual_budget_year(org_a,2026,bad);
    raise exception 'FAILED: malformed last month accepted';
  exception when invalid_parameter_value then null; end;
  if (select max(edit_version) from public.annual_budget_periods where organization_id=org_a and year_number=2026)<>before_version then
    raise exception 'FAILED: partial update';
  end if;
  foreach bad in array array[
    jsonb_set(months,'{0,expected_version}','""'),
    jsonb_set(months,'{0,expected_version}','"9223372036854775808"'),
    jsonb_set(months,'{0,expected_version}','"1.5"')
  ] loop
    begin
      perform public.save_annual_budget_year(org_b,2026,bad);
      raise exception 'FAILED: malformed expected version accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  bad:=jsonb_set(months,'{11,labor_cost}','"typo"');
  begin
    perform public.save_annual_budget_year(org_b,2026,bad);
    raise exception 'FAILED: malformed input accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.annual_budget_periods where organization_id=org_b) then raise exception 'FAILED: partial write'; end if;
  bad:=jsonb_set(months,'{11,month_number}','13');
  begin
    perform public.save_annual_budget_year(org_b,2026,bad);
    raise exception 'FAILED: invalid month accepted';
  exception when invalid_parameter_value then null; end;
  bad:=jsonb_set(months,'{11,energy_cost}','-1');
  begin
    perform public.save_annual_budget_year(org_b,2026,bad);
    raise exception 'FAILED: negative input accepted';
  exception when invalid_parameter_value then null; end;
  execute 'reset role';
  -- Table invariants also protect privileged direct writes.
  begin
    insert into public.annual_budget_periods(organization_id,year_number,month_number) values(org_a,2026,1);
    raise exception 'FAILED: duplicate month accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.annual_budget_periods(organization_id,year_number,month_number) values(org_b,2026,13);
    raise exception 'FAILED: table month check';
  exception when check_violation then null; end;
  begin
    insert into public.annual_budget_periods(organization_id,year_number,month_number,energy_cost) values(org_b,2026,1,-1);
    raise exception 'FAILED: table nonnegative check';
  exception when check_violation then null; end;
  update public.profiles set is_system_admin=false where id=u;
  insert into public.organization_members(organization_id,user_id,role_id,is_active)
    select org_a,u,id,true from public.roles where scope='ORGANIZATION' and code='ADMIN';
  execute 'set local role authenticated';
  perform public.save_annual_budget_year(org_a,2028,months);
  begin
    perform public.save_annual_budget_year(org_b,2026,months);
    raise exception 'FAILED: cross-tenant save';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.annual_budget_periods where organization_id=org_b) then raise exception 'FAILED: cross-tenant read'; end if;
  execute 'reset role';
  update public.organization_members set role_id=(select id from public.roles where scope='ORGANIZATION' and code='EMPLOYEE') where user_id=u and organization_id=org_a;
  execute 'set local role authenticated';
  if exists(select 1 from public.annual_budget_periods where organization_id=org_a) then raise exception 'FAILED: employee read'; end if;
  begin
    perform public.save_annual_budget_year(org_a,2029,months);
    raise exception 'FAILED: employee write';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end $$;
select jsonb_pretty(jsonb_build_object('result','passed','persistence','rollback follows')) as report;
rollback;
