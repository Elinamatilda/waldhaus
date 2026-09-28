# Phase 1 authorization reconciliation

## Evidence and limits

Source: the user's Supabase catalog report supplied on 2026-09-25, executed
as `postgres` against PostgreSQL 17.6. The source attachment SHA-256 is
`3405775f0b574d889caf294eee79df4cdd2357975f3e132cf4b056dc5d341208`.
`deployed-schema-observation-2026-09-25.json` preserves its parsed contents,
including table definitions, constraints, indexes, functions, triggers, policies,
and explicit/default grants. It contains catalog metadata, not application rows.

This is a **current-state observation**, not an applied migration, a complete
pg_dump, a verified project identifier, or evidence of when SQL was executed.
The report has no migration ledger: `supabase_migrations.schema_migrations`
does not exist. It does not prove that none of the historical SQL ran, nor that
any of the five repository migration versions can safely be marked applied.
There was no direct database connection during this remediation.

## Repository versus deployed state

The five existing files in `supabase/migrations` remain unchanged:

- 20260925120000_initial_auth_foundation.sql
- 20260925170000_add_system_admin_and_role_catalog.sql
- 20260925193000_sales_foundation.sql
- 20260925194500_harden_sales_tenant_integrity.sql
- 20260925201500_add_sales_import_audit.sql

The repository's second migration depends on definitions absent from earlier
repository SQL. The supplied database already has those definitions:

- `organizations`: UUID id defaulting to gen_random_uuid(), required name and
  unique slug, created_at/updated_at defaulting to now(), primary key.
- `organization_members`: UUID id defaulting to gen_random_uuid(), required
  organization_id/user_id, active flag defaulting to true, timestamps,
  unique (organization_id, user_id), cascading FKs to organizations/auth.users,
  required role_id FK to roles with UPDATE/DELETE RESTRICT.
- `profiles.avatar_url`: nullable text.
- `set_updated_at()`: trigger function setting NEW.updated_at = now().
- Enabled and forced RLS on profiles, organizations, organization_members, roles.
- Timestamp triggers on all four tables and an auth.users insert trigger.

The JSON observation contains the exact defaults, constraints, ACLs and SQL
function bodies; these descriptions are not invented historical DDL.

Additional authorization drift from repository replay:

- Deployed profiles has no `role` column or old role check constraint.
- Deployed `is_admin()`, `profiles_select_admin` and `profiles_update_admin`
  are absent. Both legacy-object/dependency arrays are empty.
- Deployed `handle_new_user()` writes id/full_name/avatar_url, never a role;
  its conflict branch updates only name/avatar. Its search_path is
  public, auth, pg_temp. Deployed profile timestamps use set_updated_at(),
  rather than the repository's original set_profile_updated_at().
- Authorization functions have explicit EXECUTE grants to anon as well as
  authenticated/service_role. REVOKE FROM PUBLIC alone in repository SQL
  does not remove explicit default anon grants. Privileged RPCs still check
  is_system_admin(); direct anonymous table access is not granted in these
  auth tables. No new function-grant policy is introduced in this phase.

The observation also contains additional Sales variant integrity structures
(e.g. product_variants_unique_org_id_customer_id_idx) not represented by the
five repository files. They are recorded but not changed in phase 1.

## Cleanup decision

No legacy cleanup migration is required for the supplied deployed state.
Do not create speculative DROP statements, reintroduce removed objects, or
apply the old files over this database. A full replay could restore obsolete
profile policies before subsequently failing on missing historical assumptions.
There is no new migration SQL and nothing to apply from this phase.

## Safe reconciliation and reproducibility gate

1. Confirm the report belongs to the intended project and capture a current
   schema-only dump using an authorized connection. Include views, event triggers,
   owners, role grants, default privileges and function bodies. The diagnostic
   report is insufficient to reconstruct all of these database objects.
2. Recover original SQL artifacts from backups, saved SQL Editor scripts or
   other authoritative records if available. Restore exact artifacts only when
   provenance and execution ordering are established. Do not guess timestamps,
   reorder existing migrations, or edit already-applied SQL.
3. If historical SQL cannot be recovered, review an explicit **present-day
   baseline/adoption plan**. It must be labelled as a new baseline, not a missing
   historical migration. Keep the old SQL as immutable historical evidence;
   define separately how existing projects adopt the baseline and how empty
   Supabase projects initialize. Do not blindly mark the five files applied.
4. Validate the approved baseline in a disposable Supabase environment, including
   role seed data and the authorization matrix below. Only then establish the
   migration ledger and resume normal forward-only migrations under review.

**Status: the required foundation is now explicit in version-controlled evidence,
  but clean database bootstrap is still blocked.** A later migration cannot
  repair an earlier migration's missing dependency. No migration repair, reset,
  baseline application, or remote schema change was performed.

`supabase/diagnostics/authorization-preflight.sql` is a read-only pretty-JSON
follow-up to confirm current effective grants, role catalog entries and absence
of legacy objects. It does not modify or initialize a migration ledger.

## Authorization review

The supplied policies/functions implement the intended split:

- System Admin: active profiles.is_system_admin; no membership required.
- Organization Admin: active profile and membership, active ORGANIZATION role
  with code ADMIN; queries/policies are scoped by organization_id.
- Employee: cannot insert/update/delete memberships through admin policies;
  profile grants cannot change is_system_admin or is_active.
- Authenticated profile table grant is SELECT; column UPDATE grants are limited
  to full_name/avatar_url. Privilege changes require a guarded System Admin RPC.
- Signup metadata cannot set platform or organization privilege.

The application now requires the observed role_id model; schema errors no longer
fall back to legacy role text or remove platform privilege from the profile shape.
User identity is accepted only from auth.getUser(). Missing/invalid sessions are
unauthenticated; transport, rate-limit, unknown and service failures throw.
Missing profiles are explicit provisioning errors. No service-role browser
credentials were added or found in application source.

## Regression checks and remaining live verification

Run `pnpm test:auth`, `pnpm lint`, `pnpm exec tsc --noEmit --incremental false`
and `pnpm build`. The tests execute actual TypeScript modules with mocked I/O;
separate evidence tests check the supplied snapshot. Neither is a live RLS test.

Final local verification on 2026-09-25: 49 authentication/evidence tests passed;
lint, TypeScript (`--noEmit --incremental false`) and the production build passed.
Tests and the final build ran outside the sandbox because sandboxed Node worker
execution/output was unreliable. Existing migration files have no diff.

In an isolated, approved database test environment, verify:

- A System Admin without membership can select organization context.
- Admin A can administer organization A but cannot read/write B or assign a
  membership in B through direct API requests.
- Employee cannot promote their membership or call privileged RPCs successfully.
- Normal profile updates cannot set is_system_admin, is_active, or protected IDs.
- Disabled profiles/roles/memberships fail closed.
- Signup creates the expected profile and does not copy authorization metadata.

Do not interpret static policy review or mock-based tests as proof that role
inheritance, every deployed object, and all live API behavior were exercised.
