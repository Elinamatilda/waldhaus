-- Review-only additive product master migration. Do not apply without approval.
begin;
do $$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
    raise exception 'Product master deployment owner requires SUPERUSER or BYPASSRLS for FORCE RLS';
  end if;
end; $$;
-- Keep the reported empty customer-coupling state stable while installing the rule.
lock table public.product_variants in access exclusive mode;
do $$ begin
  if exists(select 1 from public.product_variants where customer_id is not null) then
    raise exception 'Customer-scoped variants now exist; review their engineering identity before this migration';
  end if;
end; $$;

-- Extend the established PIECE / LINEAR_METER vocabulary, do not localize codes.
create table public.units_of_measure (
  code text primary key check(code ~ '^[A-Z][A-Z_]*$'),
  name_fi text not null, name_pl text not null, name_en text not null
);
insert into public.units_of_measure values
 ('PIECE','kpl','szt.','pcs'),('LINEAR_METER','jm','mb','rm'),
 ('CUBIC_METER','m³','m³','m³'),('SQUARE_METER','m²','m²','m²'),('KILOGRAM','kg','kg','kg');
alter table public.units_of_measure enable row level security;
alter table public.units_of_measure force row level security;
revoke all on public.units_of_measure from public,anon,authenticated;
grant select on public.units_of_measure to authenticated;
create policy uom_read on public.units_of_measure for select to authenticated using(true);

-- Prior review records an empty DISTINCT unit result; this is not a fresh live check.
-- Recheck under the variant lock: never silently normalize newly introduced legacy codes.
do $$ declare incompatible text; begin
  select string_agg(quote_literal(code), ', ' order by code) into incompatible
  from (select distinct v.default_quantity_unit_code as code from public.product_variants v
    where v.default_quantity_unit_code is not null
      and not exists(select 1 from public.units_of_measure u where u.code=v.default_quantity_unit_code)) legacy;
  if incompatible is not null then
    raise exception using errcode='23514',message='Incompatible legacy variant quantity units: '||incompatible;
  end if;
end; $$;

create sequence public.product_master_version_seq;
revoke all on sequence public.product_master_version_seq from public,anon,authenticated;
create table public.wood_species (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check(code ~ '^[a-z][a-z0-9_]*$' and length(code)<=80),
  name_fi text not null check(length(btrim(name_fi)) between 1 and 200),
  name_pl text not null check(length(btrim(name_pl)) between 1 and 200),
  name_en text not null check(length(btrim(name_en)) between 1 and 200),
  scientific_name text,
  edit_version bigint not null default nextval('public.product_master_version_seq'),
  is_active boolean not null default true, archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,code)
);
create table public.construction_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check(code ~ '^[a-z][a-z0-9_]*$' and length(code)<=80),
  name_fi text not null check(length(btrim(name_fi)) between 1 and 200),
  name_pl text not null check(length(btrim(name_pl)) between 1 and 200),
  name_en text not null check(length(btrim(name_en)) between 1 and 200),
  edit_version bigint not null default nextval('public.product_master_version_seq'),
  is_active boolean not null default true, archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,code)
);
alter table public.product_variants
  add column wood_species_id uuid,
  add column construction_type_id uuid,
  add column edit_version bigint not null default nextval('public.product_master_version_seq'),
  add constraint product_variant_customer_independent check(customer_id is null),
  add constraint product_variant_default_quantity_unit_fk foreign key(default_quantity_unit_code)
    references public.units_of_measure(code),
  add constraint product_variant_species_org_fk foreign key(organization_id,wood_species_id)
    references public.wood_species(organization_id,id) on delete restrict,
  add constraint product_variant_construction_org_fk foreign key(organization_id,construction_type_id)
    references public.construction_types(organization_id,id) on delete restrict;
comment on column public.product_variants.customer_id is 'Deprecated coupling; physical variants are customer-independent. Use customer_products.';
comment on column public.product_variants.volume_per_unit_m3 is 'Legacy supplied volume retained only for traceability. New canonical variants derive theoretical rectangular volume in the domain layer.';
comment on column public.product_variants.depth_mm is 'Legacy independent dimension; never silently substituted for length_mm.';
-- A candidate-search index, deliberately NOT a uniqueness claim about engineering identity.
create index product_variant_spec_candidates on public.product_variants
 (organization_id,product_id,wood_species_id,construction_type_id,thickness_mm,width_mm,length_mm);

create table public.customer_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null, product_variant_id uuid not null,
  customer_product_code text, customer_product_name text, notes text,
  edit_version bigint not null default nextval('public.product_master_version_seq'),
  is_active boolean not null default true, archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,customer_id,product_variant_id),
  foreign key(organization_id,customer_id) references public.customers(organization_id,id) on delete restrict,
  foreign key(organization_id,product_variant_id) references public.product_variants(organization_id,id) on delete restrict
);
create table public.customer_product_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_product_id uuid not null,
  valid_from date not null, valid_to date,
  demand_quantity numeric(18,6), demand_unit_code text references public.units_of_measure(code),
  demand_period text check(demand_period in ('YEAR','MONTH')),
  demand_year integer check(demand_year between 2020 and 2100),
  unit_price_amount numeric(18,6), pricing_basis_code text,
  currency_code text check(currency_code ~ '^[A-Z]{3}$'),
  delivery_note text, notes text,
  edit_version bigint not null default nextval('public.product_master_version_seq'),
  is_active boolean not null default true, archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,customer_product_id) references public.customer_products(organization_id,id) on delete restrict,
  check(valid_to is null or valid_to>=valid_from),
  check(demand_quantity is null or (demand_quantity>=0 and demand_quantity<1e12)),
  check(unit_price_amount is null or (unit_price_amount>=0 and unit_price_amount<1e12)),
  check((demand_quantity is null and demand_unit_code is null and demand_period is null and demand_year is null)
    or (demand_quantity is not null and demand_unit_code is not null and demand_period is not null and demand_year is not null)),
  check((unit_price_amount is null and pricing_basis_code is null and currency_code is null)
    or (unit_price_amount is not null and pricing_basis_code is not null and currency_code is not null)),
  check(pricing_basis_code in ('PER_PIECE','PER_M3','PER_LINEAR_METER','PER_M2','PER_KG'))
);
comment on table public.customer_product_terms is 'Effective-dated commercial inputs. Demand quantity has one explicit period and UOM; no redundant annual/monthly or volume/revenue totals. Sales facts retain independent historical snapshots.';
create index customer_terms_by_relationship on public.customer_product_terms(organization_id,customer_product_id,valid_from);

create function public.product_master_version() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception using errcode='23514',message='Organization is immutable';
  end if;
  new.edit_version:=nextval('public.product_master_version_seq');
  new.updated_at:=clock_timestamp();
  return new;
end; $$;
revoke all on function public.product_master_version() from public,anon,authenticated;
alter table public.wood_species enable row level security;
alter table public.wood_species force row level security;
revoke all on public.wood_species from public,anon,authenticated;
grant select on public.wood_species to authenticated;
create policy wood_species_admin_read on public.wood_species for select to authenticated
 using(public.is_organization_admin(organization_id));
create trigger zz_product_master_version before update on public.wood_species
 for each row execute function public.product_master_version();
alter table public.construction_types enable row level security;
alter table public.construction_types force row level security;
revoke all on public.construction_types from public,anon,authenticated;
grant select on public.construction_types to authenticated;
create policy construction_types_admin_read on public.construction_types for select to authenticated
 using(public.is_organization_admin(organization_id));
create trigger zz_product_master_version before update on public.construction_types
 for each row execute function public.product_master_version();
alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;
revoke all on public.product_variants from public,anon,authenticated;
grant select on public.product_variants to authenticated;
create trigger zz_product_master_version before update on public.product_variants
 for each row execute function public.product_master_version();
alter table public.customer_products enable row level security;
alter table public.customer_products force row level security;
revoke all on public.customer_products from public,anon,authenticated;
grant select on public.customer_products to authenticated;
create policy customer_products_admin_read on public.customer_products for select to authenticated
 using(public.is_organization_admin(organization_id));
create trigger zz_product_master_version before update on public.customer_products
 for each row execute function public.product_master_version();
alter table public.customer_product_terms enable row level security;
alter table public.customer_product_terms force row level security;
revoke all on public.customer_product_terms from public,anon,authenticated;
grant select on public.customer_product_terms to authenticated;
create policy customer_product_terms_admin_read on public.customer_product_terms for select to authenticated
 using(public.is_organization_admin(organization_id));
create trigger zz_product_master_version before update on public.customer_product_terms
 for each row execute function public.product_master_version();
do $$ declare col record; begin
  for col in select attname from pg_attribute where attrelid='public.product_variants'::regclass and attnum>0 and not attisdropped loop
    execute format('revoke insert (%I), update (%I), references (%I) on public.product_variants from public,anon,authenticated',col.attname,col.attname,col.attname);
  end loop;
end; $$;

-- All allowed entities/columns/types are fixed below; caller strings never become SQL identifiers.
create function public.save_product_master(
 p_organization uuid,p_entity text,p_id uuid,p_expected_version bigint,p_data jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
 table_name text; spec jsonb; item record; value jsonb; raw text; columns_sql text; assignments_sql text;
 old_row jsonb; saved jsonb; immutable_key text; parent uuid;
begin
 if auth.uid() is null or p_organization is null or public.is_organization_admin(p_organization) is not true then
   raise exception using errcode='42501',message='Forbidden';
 end if;
 case p_entity
 when 'wood_species' then table_name:='wood_species';spec:='{"code": "required", "name_fi": "required", "name_pl": "required", "name_en": "required", "scientific_name": "text", "is_active": "boolean"}'::jsonb;
 when 'construction_types' then table_name:='construction_types';spec:='{"code": "required", "name_fi": "required", "name_pl": "required", "name_en": "required", "is_active": "boolean"}'::jsonb;
 when 'product_variants' then table_name:='product_variants';spec:='{"product_id": "uuid_required", "variant_code": "required", "variant_name": "required", "wood_species_id": "uuid", "construction_type_id": "uuid", "quality_code": "text", "thickness_mm": "dimension", "width_mm": "dimension", "length_mm": "dimension", "default_quantity_unit_code": "text", "is_active": "boolean"}'::jsonb;
 when 'customer_products' then table_name:='customer_products';spec:='{"customer_id": "uuid_required", "product_variant_id": "uuid_required", "customer_product_code": "text", "customer_product_name": "text", "notes": "text", "is_active": "boolean"}'::jsonb;
 when 'customer_product_terms' then table_name:='customer_product_terms';spec:='{"customer_product_id": "uuid_required", "valid_from": "date_required", "valid_to": "date", "demand_quantity": "numeric", "demand_unit_code": "text", "demand_period": "text", "demand_year": "year", "unit_price_amount": "numeric", "pricing_basis_code": "text", "currency_code": "text", "delivery_note": "text", "notes": "text", "is_active": "boolean"}'::jsonb;
 else raise exception using errcode='22023',message='Unknown product master entity';
 end case;
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception using errcode='22023',message='Expected object'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where not (spec ? k)) then raise exception using errcode='22023',message='Unknown input field'; end if;
 for item in select j.key,j.value #>> '{}' as kind from jsonb_each(spec) as j loop
   if not (p_data ? item.key) then raise exception using errcode='22023',message='Missing input field'; end if;
   value:=p_data->item.key; raw:=p_data->>item.key;
   if value='null'::jsonb then
     if item.kind in ('required','uuid_required','date_required','boolean') then raise exception using errcode='22023',message='Required input'; end if;
     continue;
   end if;
   if item.kind='boolean' then
     if jsonb_typeof(value)<>'boolean' then raise exception using errcode='22023',message='Invalid boolean'; end if;
   elsif item.kind in ('numeric','dimension','year') then
     if jsonb_typeof(value) not in ('number','string') or length(raw)>24 or
       raw !~ (case
         when item.kind='dimension' then '^[0-9]+([.][0-9]{1,3})?$'
         when item.kind='year' then '^[0-9]{4}$'
         else '^[0-9]+([.][0-9]{1,6})?$'
       end) then
       raise exception using errcode='22023',message='Invalid numeric input';
     end if;
     if raw::numeric>=1e12 or (item.kind='dimension' and (raw::numeric<=0 or raw::numeric>=1e7)) or (item.kind='year' and raw::integer not between 2020 and 2100) then
       raise exception using errcode='22023',message='Numeric input out of range';
     end if;
   else
     if jsonb_typeof(value)<>'string' or length(raw)>4000 then raise exception using errcode='22023',message='Invalid text input'; end if;
     if item.kind='required' and (length(btrim(raw))=0 or length(raw)>200) then raise exception using errcode='22023',message='Required name or code'; end if;
     if item.kind like 'uuid%' and raw !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception using errcode='22023',message='Invalid UUID'; end if;
     if item.kind like 'date%' then
       if raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception using errcode='22023',message='Invalid date'; end if;
       perform raw::date;
     end if;
   end if;
 end loop;
 -- One common lock orders all controlled changes to masters and their relationships.
 perform pg_advisory_xact_lock(hashtextextended(p_organization::text,682914));
 if p_id is null then
   if p_expected_version is not null then raise exception using errcode='40001',message='Unexpected version for new record'; end if;
 else
   execute format('select to_jsonb(t) from public.%I t where organization_id=$1 and id=$2 for update',table_name)
     into old_row using p_organization,p_id;
   if old_row is null or p_expected_version is null or (old_row->>'edit_version')::bigint<>p_expected_version then
     raise exception using errcode='40001',message='Product master changed; refresh before saving';
   end if;
   foreach immutable_key in array array['code','variant_code','product_id','customer_id','product_variant_id','customer_product_id'] loop
     if spec ? immutable_key and old_row->immutable_key is distinct from p_data->immutable_key then
       raise exception using errcode='23514',message='Identity reference is immutable; create a new record';
     end if;
   end loop;
 end if;
 if p_entity='product_variants' then
   if (p_data->>'variant_code') !~ '^[A-Z0-9][A-Z0-9._-]{0,79}$' then raise exception using errcode='22023',message='Invalid stable variant code'; end if;
   perform 1 from public.products where organization_id=p_organization and id=(p_data->>'product_id')::uuid
     and (not (p_data->>'is_active')::boolean or is_active) for share;
   if not found then raise exception using errcode='23503',message='Product unavailable in organization'; end if;
   if p_data->>'wood_species_id' is not null then
     perform 1 from public.wood_species where organization_id=p_organization and id=(p_data->>'wood_species_id')::uuid
       and (not (p_data->>'is_active')::boolean or is_active) for share;
     if not found then raise exception using errcode='23503',message='Wood species unavailable in organization'; end if;
   end if;
   if p_data->>'construction_type_id' is not null then
     perform 1 from public.construction_types where organization_id=p_organization and id=(p_data->>'construction_type_id')::uuid
       and (not (p_data->>'is_active')::boolean or is_active) for share;
     if not found then raise exception using errcode='23503',message='Construction type unavailable in organization'; end if;
   end if;
   if p_data->>'default_quantity_unit_code' is not null and not exists(select 1 from public.units_of_measure where code=p_data->>'default_quantity_unit_code') then
     raise exception using errcode='22023',message='Unknown quantity unit';
   end if;
   if p_id is not null and (exists(select 1 from public.sales_facts where organization_id=p_organization and product_variant_id=p_id) or exists(select 1 from public.customer_products where organization_id=p_organization and product_variant_id=p_id)) then
     foreach immutable_key in array array['wood_species_id','construction_type_id','quality_code','thickness_mm','width_mm','length_mm'] loop
       -- Compare typed values below via populate_record, avoiding numeric/string representation differences.
       if (select to_jsonb(v)->immutable_key from jsonb_populate_record(null::public.product_variants,p_data) v) is distinct from old_row->immutable_key then
         raise exception using errcode='23514',message='Referenced physical specification is immutable; create a new variant';
       end if;
     end loop;
   end if;
 elsif p_entity='customer_products' then
   perform 1 from public.customers where organization_id=p_organization and id=(p_data->>'customer_id')::uuid
     and (not (p_data->>'is_active')::boolean or is_active) for share;
   if not found then raise exception using errcode='23503',message='Customer unavailable in organization'; end if;
   perform 1 from public.product_variants where organization_id=p_organization and id=(p_data->>'product_variant_id')::uuid
     and (not (p_data->>'is_active')::boolean or is_active) for share;
   if not found then raise exception using errcode='23503',message='Variant unavailable in organization'; end if;
 elsif p_entity='customer_product_terms' then
   parent:=(p_data->>'customer_product_id')::uuid;
   perform 1 from public.customer_products where organization_id=p_organization and id=parent
     and (not (p_data->>'is_active')::boolean or is_active) for update;
   if not found then raise exception using errcode='23503',message='Customer product unavailable'; end if;
   if (p_data->>'is_active')::boolean and exists(
     select 1 from public.customer_product_terms t where t.organization_id=p_organization and t.customer_product_id=parent and t.is_active
       and (p_id is null or t.id<>p_id)
       and t.valid_from<=coalesce((p_data->>'valid_to')::date,'infinity'::date)
       and coalesce(t.valid_to,'infinity'::date)>=(p_data->>'valid_from')::date
   ) then raise exception using errcode='23514',message='Active commercial term periods overlap'; end if;
 end if;
 select string_agg(format('%I',key),',' order by key),string_agg(format('%I=r.%I',key,key),',' order by key)
   into columns_sql,assignments_sql from jsonb_object_keys(spec) as keys(key);
 if p_id is null then
   execute format('insert into public.%I (organization_id,%s,created_by,updated_by,archived_at) select $1,%s,$3,$3,case when r.is_active then null else clock_timestamp() end from jsonb_populate_record(null::public.%I,$2) r returning jsonb_build_object(''id'',id,''edit_version'',edit_version::text)',table_name,columns_sql,columns_sql,table_name)
     into saved using p_organization,p_data,auth.uid();
 else
   execute format('update public.%I t set %s,updated_by=$4,archived_at=case when r.is_active then null else coalesce(t.archived_at,clock_timestamp()) end from jsonb_populate_record(null::public.%I,$3) r where t.organization_id=$1 and t.id=$2 returning jsonb_build_object(''id'',t.id,''edit_version'',t.edit_version::text)',table_name,assignments_sql,table_name)
     into saved using p_organization,p_id,p_data,auth.uid();
 end if;
 return saved;
end; $$;
revoke all on function public.save_product_master(uuid,text,uuid,bigint,jsonb) from public,anon;
grant execute on function public.save_product_master(uuid,text,uuid,bigint,jsonb) to authenticated;
commit;
