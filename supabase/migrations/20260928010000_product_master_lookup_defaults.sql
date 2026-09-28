-- Populate the existing organization-scoped Product Master lookups.
-- Requires 20260926010000_product_master_commercial.sql.
-- Preserve existing IDs, labels, archive state and references; do not reset masters.
begin;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception 'Product lookup seed requires SUPERUSER or BYPASSRLS for FORCE RLS';
  end if;
end;
$$;

insert into public.wood_species (organization_id, code, name_fi, name_pl, name_en)
select organization.id, species.code, species.name_fi, species.name_pl, species.name_en
from public.organizations as organization
cross join (values
  ('oak', 'Tammi', 'Dąb', 'Oak'),
  ('birch', 'Koivu', 'Brzoza', 'Birch')
) as species(code, name_fi, name_pl, name_en)
on conflict (organization_id, code) do nothing;

insert into public.construction_types (organization_id, code, name_fi, name_pl, name_en)
select organization.id, construction.code, construction.name_fi, construction.name_pl, construction.name_en
from public.organizations as organization
cross join (values
  ('solid', 'Massiivipuu', 'Lite drewno', 'Solid'),
  ('finger_jointed', 'Sormijatkettu', 'Łączone na mikrowczepy', 'Finger-jointed')
) as construction(code, name_fi, name_pl, name_en)
on conflict (organization_id, code) do nothing;

commit;
