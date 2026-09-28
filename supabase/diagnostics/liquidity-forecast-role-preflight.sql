-- READ ONLY. Returns one pretty JSON report; never changes roles, grants or schema.
begin transaction read only;
select jsonb_pretty(jsonb_build_object(
 'session_user',session_user,
 'execution_user',current_user,
 'deployment_roles',(select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'can_login',rolcanlogin)) from pg_roles where rolname in ('postgres',current_user)),
 'auth_helper',(select jsonb_build_object('owner',pg_get_userbyid(proowner),'owner_superuser',(select rolsuper from pg_roles where oid=proowner),'owner_bypass_rls',(select rolbypassrls from pg_roles where oid=proowner),'security_definer',prosecdef,'settings',proconfig) from pg_proc where oid=to_regprocedure('public.is_organization_admin(uuid)')),
 'liquidity_table',(select jsonb_build_object('owner',pg_get_userbyid(relowner),'rls',relrowsecurity,'force_rls',relforcerowsecurity) from pg_class where oid=to_regclass('public.liquidity_forecast_periods')),
 'liquidity_rpc',(select jsonb_build_object('owner',pg_get_userbyid(proowner),'owner_superuser',(select rolsuper from pg_roles where oid=proowner),'owner_bypass_rls',(select rolbypassrls from pg_roles where oid=proowner),'security_definer',prosecdef,'settings',proconfig) from pg_proc where oid=to_regprocedure('public.save_liquidity_forecast_year(uuid,integer,jsonb)'))
)) as report;
rollback;
