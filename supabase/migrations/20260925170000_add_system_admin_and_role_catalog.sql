-- Waldhaus authorization upgrade:
-- - platform-level system admin on profiles
-- - organization role catalog table
-- - organization_members role text -> role_id fk migration
-- - helper and RLS refactor for safe authorization precedence

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  scope text not null,
  name_key text not null,
  description_key text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.roles is 'Canonical role definitions. Translated labels are resolved in UI from localization keys.';
comment on column public.roles.code is 'Stable language-independent role code, for example ADMIN or EMPLOYEE.';
comment on column public.roles.scope is 'Role scope, for example ORGANIZATION.';

insert into public.roles (code, scope, name_key, description_key, sort_order, is_active)
values
  ('ADMIN', 'ORGANIZATION', 'roles.admin.name', 'roles.admin.description', 10, true),
  ('EMPLOYEE', 'ORGANIZATION', 'roles.employee.name', 'roles.employee.description', 20, true)
on conflict (code) do update
set
  scope = excluded.scope,
  name_key = excluded.name_key,
  description_key = excluded.description_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create index if not exists roles_scope_active_sort_idx
on public.roles (scope, is_active, sort_order, code);

drop trigger if exists set_roles_updated_at on public.roles;
create trigger set_roles_updated_at
before update on public.roles
for each row
execute function public.set_updated_at();

alter table public.roles enable row level security;
alter table public.roles force row level security;

alter table public.profiles
add column if not exists is_system_admin boolean not null default false;

comment on column public.profiles.is_system_admin is 'Platform-level Waldhaus administrator privilege. Not an organization membership role.';

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_temp
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.is_active = true
      and p.is_system_admin = true
  );
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_temp
as $$
  select exists (
    select 1
    from public.organization_members as m
    join public.profiles as p on p.id = m.user_id
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and p.is_active = true
  );
$$;

alter table public.organization_members
add column if not exists role_id uuid;

comment on column public.organization_members.role_id is 'Organization role reference to public.roles.';

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_temp
as $$
  select
    public.is_system_admin()
    or exists (
      select 1
      from public.organization_members as m
      join public.profiles as p on p.id = m.user_id
      join public.roles as r on r.id = m.role_id
      where m.organization_id = target_organization_id
        and m.user_id = auth.uid()
        and m.is_active = true
        and p.is_active = true
        and r.scope = 'ORGANIZATION'
        and r.code = 'ADMIN'
        and r.is_active = true
    );
$$;

create or replace function public.can_read_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_temp
as $$
  select public.is_system_admin() or public.is_organization_member(target_organization_id);
$$;

create or replace function public.can_admin_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_temp
as $$
  select public.is_system_admin() or public.is_organization_admin(target_organization_id);
$$;

revoke all on function public.is_system_admin() from public;
revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_admin(uuid) from public;
revoke all on function public.can_read_organization(uuid) from public;
revoke all on function public.can_admin_organization(uuid) from public;

grant execute on function public.is_system_admin() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.can_read_organization(uuid) to authenticated;
grant execute on function public.can_admin_organization(uuid) to authenticated;

create or replace function public.system_admin_set_profile_privilege(
  target_profile_id uuid,
  target_is_active boolean,
  target_is_system_admin boolean
)
returns void
language plpgsql
security definer
set search_path = pg_temp
as $$
begin
  if not public.is_system_admin() then
    raise exception 'insufficient_privilege';
  end if;

  update public.profiles as p
  set
    is_active = target_is_active,
    is_system_admin = target_is_system_admin
  where p.id = target_profile_id;

  if not found then
    raise exception 'profile_not_found';
  end if;
end;
$$;

create or replace function public.system_admin_create_organization(
  organization_name text,
  organization_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = pg_temp
as $$
declare
  inserted_org public.organizations;
begin
  if not public.is_system_admin() then
    raise exception 'insufficient_privilege';
  end if;

  insert into public.organizations (name, slug)
  values (organization_name, organization_slug)
  returning * into inserted_org;

  return inserted_org;
end;
$$;

create or replace function public.system_admin_delete_organization(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_temp
as $$
begin
  if not public.is_system_admin() then
    raise exception 'insufficient_privilege';
  end if;

  delete from public.organizations as o
  where o.id = target_organization_id;

  if not found then
    raise exception 'organization_not_found';
  end if;
end;
$$;

create or replace function public.system_admin_create_role(
  role_code text,
  role_scope text,
  role_name_key text,
  role_description_key text,
  role_sort_order integer,
  role_is_active boolean
)
returns public.roles
language plpgsql
security definer
set search_path = pg_temp
as $$
declare
  inserted_role public.roles;
begin
  if not public.is_system_admin() then
    raise exception 'insufficient_privilege';
  end if;

  insert into public.roles (code, scope, name_key, description_key, sort_order, is_active)
  values (role_code, role_scope, role_name_key, role_description_key, role_sort_order, role_is_active)
  returning * into inserted_role;

  return inserted_role;
end;
$$;

create or replace function public.system_admin_update_role(
  target_role_id uuid,
  role_scope text,
  role_name_key text,
  role_description_key text,
  role_sort_order integer,
  role_is_active boolean
)
returns public.roles
language plpgsql
security definer
set search_path = pg_temp
as $$
declare
  updated_role public.roles;
begin
  if not public.is_system_admin() then
    raise exception 'insufficient_privilege';
  end if;

  update public.roles as r
  set
    scope = role_scope,
    name_key = role_name_key,
    description_key = role_description_key,
    sort_order = role_sort_order,
    is_active = role_is_active
  where r.id = target_role_id
  returning * into updated_role;

  if not found then
    raise exception 'role_not_found';
  end if;

  return updated_role;
end;
$$;

create or replace function public.system_admin_delete_role(target_role_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_temp
as $$
begin
  if not public.is_system_admin() then
    raise exception 'insufficient_privilege';
  end if;

  delete from public.roles as r
  where r.id = target_role_id;

  if not found then
    raise exception 'role_not_found';
  end if;
end;
$$;

revoke all on function public.system_admin_set_profile_privilege(uuid, boolean, boolean) from public;
revoke all on function public.system_admin_create_organization(text, text) from public;
revoke all on function public.system_admin_delete_organization(uuid) from public;
revoke all on function public.system_admin_create_role(text, text, text, text, integer, boolean) from public;
revoke all on function public.system_admin_update_role(uuid, text, text, text, integer, boolean) from public;
revoke all on function public.system_admin_delete_role(uuid) from public;

grant execute on function public.system_admin_set_profile_privilege(uuid, boolean, boolean) to authenticated;
grant execute on function public.system_admin_create_organization(text, text) to authenticated;
grant execute on function public.system_admin_delete_organization(uuid) to authenticated;
grant execute on function public.system_admin_create_role(text, text, text, text, integer, boolean) to authenticated;
grant execute on function public.system_admin_update_role(uuid, text, text, text, integer, boolean) to authenticated;
grant execute on function public.system_admin_delete_role(uuid) to authenticated;

do $$
declare
  unknown_role_count integer;
begin
  select count(*)
  into unknown_role_count
  from public.organization_members as m
  where m.role is null
     or lower(trim(m.role)) not in ('admin', 'employee');

  if unknown_role_count > 0 then
    raise exception using
      message = format('Migration aborted: %s organization_members rows have unknown legacy role values.', unknown_role_count),
      hint = 'Resolve legacy role text values before retrying this migration.';
  end if;
end;
$$;

update public.organization_members as m
set role_id = r.id
from public.roles as r
where m.role_id is null
  and r.scope = 'ORGANIZATION'
  and r.code = upper(trim(m.role));

do $$
declare
  missing_role_id_count integer;
begin
  select count(*)
  into missing_role_id_count
  from public.organization_members as m
  where m.role_id is null;

  if missing_role_id_count > 0 then
    raise exception using
      message = format('Migration aborted: %s organization_members rows were not backfilled to role_id.', missing_role_id_count),
      hint = 'Verify role seed rows and legacy membership role values.';
  end if;
end;
$$;

alter table public.organization_members
drop constraint if exists organization_members_role_id_fkey;

alter table public.organization_members
add constraint organization_members_role_id_fkey
foreign key (role_id)
references public.roles (id)
on update restrict
on delete restrict;

create index if not exists organization_members_role_id_idx
on public.organization_members (role_id);

alter table public.organization_members
alter column role_id set not null;

-- Keep table-level grants minimal and RLS-controlled.
revoke all on public.roles from anon;
revoke all on public.roles from authenticated;
grant select on public.roles to authenticated;

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

revoke all on public.organizations from anon;
revoke all on public.organizations from authenticated;
grant select, update on public.organizations to authenticated;

revoke all on public.organization_members from anon;
revoke all on public.organization_members from authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;

drop policy if exists "roles_select_active_organization_roles" on public.roles;
create policy "roles_select_active_organization_roles"
on public.roles
for select
to authenticated
using (scope = 'ORGANIZATION' and is_active = true);

drop policy if exists "roles_select_system_admin" on public.roles;
create policy "roles_select_system_admin"
on public.roles
for select
to authenticated
using (public.is_system_admin());

drop policy if exists "roles_insert_system_admin" on public.roles;
create policy "roles_insert_system_admin"
on public.roles
for insert
to authenticated
with check (public.is_system_admin());

drop policy if exists "roles_update_system_admin" on public.roles;
create policy "roles_update_system_admin"
on public.roles
for update
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "roles_delete_system_admin" on public.roles;
create policy "roles_delete_system_admin"
on public.roles
for delete
to authenticated
using (public.is_system_admin());

drop policy if exists "organizations_select_member" on public.organizations;
drop policy if exists "organizations_select_scoped_or_system_admin" on public.organizations;
create policy "organizations_select_scoped_or_system_admin"
on public.organizations
for select
to authenticated
using (public.can_read_organization(id));

drop policy if exists "organizations_update_admin" on public.organizations;
drop policy if exists "organizations_update_admin_or_system_admin" on public.organizations;
create policy "organizations_update_admin_or_system_admin"
on public.organizations
for update
to authenticated
using (public.can_admin_organization(id))
with check (public.can_admin_organization(id));

drop policy if exists "organizations_insert_system_admin" on public.organizations;
create policy "organizations_insert_system_admin"
on public.organizations
for insert
to authenticated
with check (public.is_system_admin());

drop policy if exists "organizations_delete_system_admin" on public.organizations;
create policy "organizations_delete_system_admin"
on public.organizations
for delete
to authenticated
using (public.is_system_admin());

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_select_system_admin" on public.profiles;
create policy "profiles_select_system_admin"
on public.profiles
for select
to authenticated
using (public.is_system_admin());

drop policy if exists "profiles_update_own_safe" on public.profiles;
create policy "profiles_update_own_safe"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and is_active = (
    select current_profile.is_active
    from public.profiles as current_profile
    where current_profile.id = auth.uid()
  )
  and created_at = (
    select current_profile.created_at
    from public.profiles as current_profile
    where current_profile.id = auth.uid()
  )
  and is_system_admin = (
    select current_profile.is_system_admin
    from public.profiles as current_profile
    where current_profile.id = auth.uid()
  )
);

drop policy if exists "profiles_update_system_admin" on public.profiles;
create policy "profiles_update_system_admin"
on public.profiles
for update
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "organization_members_select_own" on public.organization_members;
create policy "organization_members_select_own"
on public.organization_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "organization_members_select_admin" on public.organization_members;
drop policy if exists "organization_members_select_admin_or_system_admin" on public.organization_members;
create policy "organization_members_select_admin_or_system_admin"
on public.organization_members
for select
to authenticated
using (public.can_admin_organization(organization_id));

drop policy if exists "organization_members_insert_admin" on public.organization_members;
drop policy if exists "organization_members_insert_admin_or_system_admin" on public.organization_members;
create policy "organization_members_insert_admin_or_system_admin"
on public.organization_members
for insert
to authenticated
with check (
  public.can_admin_organization(organization_id)
  and exists (
    select 1
    from public.roles as r
    where r.id = role_id
      and r.scope = 'ORGANIZATION'
      and r.is_active = true
  )
);

drop policy if exists "organization_members_update_admin" on public.organization_members;
drop policy if exists "organization_members_update_admin_or_system_admin" on public.organization_members;
create policy "organization_members_update_admin_or_system_admin"
on public.organization_members
for update
to authenticated
using (public.can_admin_organization(organization_id))
with check (
  public.can_admin_organization(organization_id)
  and exists (
    select 1
    from public.roles as r
    where r.id = role_id
      and r.scope = 'ORGANIZATION'
      and r.is_active = true
  )
);

drop policy if exists "organization_members_delete_admin" on public.organization_members;
drop policy if exists "organization_members_delete_admin_or_system_admin" on public.organization_members;
create policy "organization_members_delete_admin_or_system_admin"
on public.organization_members
for delete
to authenticated
using (public.can_admin_organization(organization_id));

alter table public.organization_members
drop constraint if exists organization_members_role_check;

alter table public.organization_members
drop column if exists role;

-- Future Inventory policy pattern (for upcoming inventory tables):
-- READ:
--   public.is_system_admin() OR public.is_organization_member(organization_id)
-- ADMIN WRITE:
--   public.is_system_admin() OR public.is_organization_admin(organization_id)

-- Trusted one-time bootstrap template (do not execute automatically in migration):
-- update public.profiles
-- set is_system_admin = true
-- where id = '<AUTH_USER_UUID>'::uuid;
--
-- select
--   id,
--   full_name,
--   is_system_admin
-- from public.profiles
-- where id = '<AUTH_USER_UUID>'::uuid;