-- Read-only follow-up; returns one pretty JSON report. No migration repair/DDL.
BEGIN TRANSACTION READ ONLY;

SELECT jsonb_pretty(jsonb_build_object(
  'migration_history_table', to_regclass('supabase_migrations.schema_migrations')::text,
  'legacy_profile_role_exists', EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('public.profiles')
      AND attname = 'role' AND NOT attisdropped
  ),
  'legacy_membership_role_exists', EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('public.organization_members')
      AND attname = 'role' AND NOT attisdropped
  ),
  'legacy_admin_functions', COALESCE((
    SELECT jsonb_agg(p.oid::regprocedure::text ORDER BY p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ), '[]'::jsonb),
  'legacy_policies', COALESCE((
    SELECT jsonb_agg(policyname ORDER BY policyname) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname IN ('profiles_select_admin', 'profiles_update_admin')
  ), '[]'::jsonb),
  'role_catalog', (SELECT jsonb_agg(jsonb_build_object(
    'code', code, 'scope', scope, 'is_active', is_active
  ) ORDER BY code) FROM public.roles),
  'tables', (SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity
  ) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('profiles', 'organizations', 'organization_members', 'roles')),
  'effective_profile_update_grants', (SELECT jsonb_agg(jsonb_build_object(
    'role', r.rolname, 'column', a.attname,
    'can_update', has_column_privilege(r.oid, a.attrelid, a.attnum, 'UPDATE')
  ) ORDER BY r.rolname, a.attnum)
    FROM pg_roles r CROSS JOIN pg_attribute a
    WHERE r.rolname IN ('anon', 'authenticated')
      AND a.attrelid = 'public.profiles'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped)
)) AS report;

ROLLBACK;
