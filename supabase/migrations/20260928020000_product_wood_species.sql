-- Product-level offered species, separate from a physical variant's single species.
-- Requires the existing Product Master migration. No variants are created or changed.
begin;

do $$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
    raise exception 'Product species deployment owner requires SUPERUSER or BYPASSRLS for FORCE RLS';
  end if;
end;
$$;

create table public.product_wood_species (
  organization_id uuid not null,
  product_id uuid not null,
  wood_species_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, product_id, wood_species_id),
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete cascade,
  foreign key (organization_id, wood_species_id) references public.wood_species(organization_id, id) on delete restrict
);
comment on table public.product_wood_species is 'Species offered for a product family. Each physical variant still has one species. Selection creates no variants.';
alter table public.product_wood_species enable row level security;
alter table public.product_wood_species force row level security;
revoke all on public.product_wood_species from public, anon, authenticated;
grant select on public.product_wood_species to authenticated;
create policy product_species_admin_read on public.product_wood_species
  for select to authenticated using (public.is_organization_admin(organization_id));

create function public.save_product_wood_species(
  p_organization uuid, p_product uuid, p_expected uuid[], p_selected uuid[]
) returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  current_ids uuid[];
  expected_ids uuid[];
  selected_ids uuid[];
begin
  if auth.uid() is null or p_organization is null or public.is_organization_admin(p_organization) is not true then
    raise exception using errcode='42501',message='Forbidden';
  end if;
  if p_expected is null or p_selected is null or cardinality(p_expected)>100 or cardinality(p_selected)>100
     or array_ndims(p_expected)>1 or array_ndims(p_selected)>1
     or array_position(p_expected,null) is not null or array_position(p_selected,null) is not null then
    raise exception using errcode='22023',message='Invalid species selection';
  end if;
  select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into expected_ids from unnest(p_expected) as ids(id);
  select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into selected_ids from unnest(p_selected) as ids(id);
  if cardinality(expected_ids)<>cardinality(p_expected) or cardinality(selected_ids)<>cardinality(p_selected) then
    raise exception using errcode='22023',message='Duplicate species';
  end if;

  -- Use the same organization lock ordering as canonical Product Master writes.
  perform pg_advisory_xact_lock(hashtextextended(p_organization::text, 682914));
  perform 1 from public.products where organization_id=p_organization and id=p_product and is_active for update;
  if not found then raise exception using errcode='23503',message='Active product unavailable'; end if;
  select coalesce(array_agg(wood_species_id order by wood_species_id),'{}'::uuid[]) into current_ids
    from public.product_wood_species where organization_id=p_organization and product_id=p_product;
  if current_ids is distinct from expected_ids then
    raise exception using errcode='40001',message='Product species changed; refresh before saving';
  end if;

  -- Lock the referenced rows against a concurrent archive. Retaining an archived
  -- selection is allowed, but adding a newly archived species is not.
  perform 1 from public.wood_species
    where organization_id=p_organization and id=any(selected_ids) order by id for share;
  if exists(select 1 from unnest(selected_ids) as selected(selected_id) where not exists(
    select 1 from public.wood_species s where s.organization_id=p_organization and s.id=selected_id
      and (s.is_active or s.id=any(current_ids))
  )) then raise exception using errcode='23503',message='Species unavailable in organization'; end if;

  delete from public.product_wood_species
    where organization_id=p_organization and product_id=p_product and not (wood_species_id=any(selected_ids));
  insert into public.product_wood_species(organization_id,product_id,wood_species_id,created_by)
    select p_organization,p_product,id,auth.uid() from unnest(selected_ids) as ids(id)
    on conflict (organization_id,product_id,wood_species_id) do nothing;
end;
$$;
revoke all on function public.save_product_wood_species(uuid,uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.save_product_wood_species(uuid,uuid,uuid[],uuid[]) to authenticated;
commit;
