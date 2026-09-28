-- Review/test artifact only. Run in a DISPOSABLE Supabase DB after approved migration.
-- No migrations are applied by this test. Test data is rolled back.
begin;
do $$
declare
  u uuid:=gen_random_uuid(); org_a uuid:=gen_random_uuid(); org_b uuid:=gen_random_uuid();
  saved jsonb; months jsonb; bad jsonb; fresh jsonb; stale jsonb; year integer; count_rows integer; before_version bigint;
begin
  insert into auth.users(id,email) values(u,u::text||'@test.invalid');
  update public.profiles set is_active=true,is_system_admin=true where id=u;
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.organizations(id,name,slug) values(org_a,'Budget A',org_a::text),(org_b,'Budget B',org_b::text);
  select jsonb_agg(jsonb_build_object('month_number',n,'expected_version',null,
    'opening_balance',null,'forecasted_sales',1000,'other_forecasted_income',100,'total_outflows',100,'minimum_required_balance',100) order by n)
  into months from generate_series(1,12) n;
  months:=jsonb_set(months,'{0,forecasted_sales}','null');
  months:=jsonb_set(months,'{1,forecasted_sales}','0');
  -- System Admin has no membership; explicitly scoped RPC creates 12 rows per year.
  execute 'set local role authenticated';
  foreach year in array array[2025,2026,2027] loop
    saved:=public.save_liquidity_forecast_year(org_a,year,months);
    if (saved->>'year')::integer<>year or jsonb_array_length(saved->'months')<>12 then
      raise exception 'FAILED: incomplete save response';
    end if;
    if exists (
      select 1 from jsonb_array_elements(saved->'months') item
      left join public.liquidity_forecast_periods p
        on p.organization_id=org_a and p.year_number=year and p.month_number=(item->>'month_number')::integer
      where p.id is null or jsonb_typeof(item->'edit_version')<>'string'
        or p.edit_version is distinct from (item->>'edit_version')::bigint
    ) then raise exception 'FAILED: response versions differ from canonical rows'; end if;
  end loop;
  select count(*) into count_rows from public.liquidity_forecast_periods where organization_id=org_a;
  if count_rows<>36 then raise exception 'FAILED: multiple years'; end if;
  begin
    perform public.save_liquidity_forecast_year(org_a,2026,months);
    raise exception 'FAILED: stale empty versions accepted';
  exception when serialization_failure then null; end;
  if exists(select 1 from public.liquidity_forecast_periods where organization_id=org_a and opening_balance is not null) then
    raise exception 'FAILED: NULL openings were changed';
  end if;
  if (select forecasted_sales from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026 and month_number=1) is not null then
    raise exception 'FAILED: NULL source lost';
  end if;
  if (select forecasted_sales from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026 and month_number=2) is distinct from 0::numeric then
    raise exception 'FAILED: explicit zero lost';
  end if;
  foreach bad in array array[
    jsonb_set(months,'{11}','null'), jsonb_set(months,'{11}','[]'),
    jsonb_set(months,'{11}','123'), jsonb_set(months,'{11}','"text"'),
    months #- '{11,forecasted_sales}'
  ] loop
    begin
      perform public.save_liquidity_forecast_year(org_b,2026,bad);
      raise exception 'FAILED: invalid month shape or missing key accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  if exists(select 1 from public.liquidity_forecast_periods where organization_id=org_b) then
    raise exception 'FAILED: partial write for invalid shape';
  end if;
  select jsonb_agg((months->(month_number-1)) || jsonb_build_object('expected_version',edit_version) order by month_number)
    into fresh from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026;
  stale:=fresh;
  select max(edit_version) into before_version from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026;
  -- Every month may independently persist a negative or explicit-zero opening.
  fresh:=jsonb_set(fresh,'{0,opening_balance}','-100');
  fresh:=jsonb_set(fresh,'{1,opening_balance}','0');
  perform public.save_liquidity_forecast_year(org_a,2026,fresh);
  if (select opening_balance from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026 and month_number=1) is distinct from -100::numeric then
    raise exception 'FAILED: negative opening not persisted';
  end if;
  if (select opening_balance from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026 and month_number=2) is distinct from 0::numeric then
    raise exception 'FAILED: explicit zero opening not persisted';
  end if;
  if exists(select 1 from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026 and month_number>2 and opening_balance is not null) then
    raise exception 'FAILED: opening was chained into later months';
  end if;
  if (select min(edit_version) from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026)<=before_version then
    raise exception 'FAILED: version did not advance';
  end if;
  begin
    perform public.save_liquidity_forecast_year(org_a,2026,stale);
    raise exception 'FAILED: stale non-null versions accepted';
  exception when serialization_failure then null; end;
  select jsonb_agg((months->(month_number-1)) || jsonb_build_object('expected_version',edit_version) order by month_number)
    into fresh from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026;
  select max(edit_version) into before_version from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026;
  bad:=jsonb_set(fresh,'{11,total_outflows}','"wrong"');
  begin
    perform public.save_liquidity_forecast_year(org_a,2026,bad);
    raise exception 'FAILED: malformed last month accepted';
  exception when invalid_parameter_value then null; end;
  if (select max(edit_version) from public.liquidity_forecast_periods where organization_id=org_a and year_number=2026)<>before_version then
    raise exception 'FAILED: partial update';
  end if;
  foreach bad in array array[
    jsonb_set(months,'{0,expected_version}','""'),
    jsonb_set(months,'{0,expected_version}','"9223372036854775808"'),
    jsonb_set(months,'{0,expected_version}','"1.5"')
  ] loop
    begin
      perform public.save_liquidity_forecast_year(org_b,2026,bad);
      raise exception 'FAILED: malformed expected version accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  bad:=jsonb_set(months,'{11,minimum_required_balance}','"typo"');
  begin
    perform public.save_liquidity_forecast_year(org_b,2026,bad);
    raise exception 'FAILED: malformed input accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.liquidity_forecast_periods where organization_id=org_b) then raise exception 'FAILED: partial write'; end if;
  bad:=jsonb_set(months,'{11,month_number}','13');
  begin
    perform public.save_liquidity_forecast_year(org_b,2026,bad);
    raise exception 'FAILED: invalid month accepted';
  exception when invalid_parameter_value then null; end;
  bad:=jsonb_set(months,'{11,total_outflows}','-1');
  begin
    perform public.save_liquidity_forecast_year(org_b,2026,bad);
    raise exception 'FAILED: negative input accepted';
  exception when invalid_parameter_value then null; end;
  execute 'reset role';
  -- Table invariants also protect privileged direct writes.
  begin
    insert into public.liquidity_forecast_periods(organization_id,year_number,month_number,opening_balance) values(org_a,2026,1,null);
    raise exception 'FAILED: duplicate month accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.liquidity_forecast_periods(organization_id,year_number,month_number) values(org_b,2026,13);
    raise exception 'FAILED: table month check';
  exception when check_violation then null; end;
  begin
    insert into public.liquidity_forecast_periods(organization_id,year_number,month_number,opening_balance,total_outflows) values(org_b,2026,1,null,-1);
    raise exception 'FAILED: table nonnegative check';
  exception when check_violation then null; end;
  update public.profiles set is_system_admin=false where id=u;
  insert into public.organization_members(organization_id,user_id,role_id,is_active)
    select org_a,u,id,true from public.roles where scope='ORGANIZATION' and code='ADMIN';
  execute 'set local role authenticated';
  perform public.save_liquidity_forecast_year(org_a,2028,months);
  begin
    perform public.save_liquidity_forecast_year(org_b,2026,months);
    raise exception 'FAILED: cross-tenant save';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.liquidity_forecast_periods where organization_id=org_b) then raise exception 'FAILED: cross-tenant read'; end if;
  execute 'reset role';
  update public.organization_members set role_id=(select id from public.roles where scope='ORGANIZATION' and code='EMPLOYEE') where user_id=u and organization_id=org_a;
  execute 'set local role authenticated';
  if exists(select 1 from public.liquidity_forecast_periods where organization_id=org_a) then raise exception 'FAILED: employee read'; end if;
  begin
    perform public.save_liquidity_forecast_year(org_a,2029,months);
    raise exception 'FAILED: employee write';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end $$;
select jsonb_pretty(jsonb_build_object('result','passed','persistence','rollback follows')) as report;
rollback;
