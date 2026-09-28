-- DISPOSABLE DATABASE ONLY, after Product Master and product_wood_species migrations.
-- All fixture data is rolled back. Not a production deployment script.
begin;
do $$
declare
  admin_user uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid();
  org_a uuid:=gen_random_uuid(); org_b uuid:=gen_random_uuid();
  product_a uuid:=gen_random_uuid(); product_b uuid:=gen_random_uuid();
  oak uuid:=gen_random_uuid(); birch uuid:=gen_random_uuid(); foreign_species uuid:=gen_random_uuid();
  variant uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email) values(admin_user,admin_user::text||'@example.invalid'),(other_user,other_user::text||'@example.invalid');
  update public.profiles set is_system_admin=true,is_active=true where id=admin_user;
  insert into public.organizations(id,name,slug) values(org_a,'Species A',org_a::text),(org_b,'Species B',org_b::text);
  insert into public.products(id,organization_id,name) values(product_a,org_a,'Thresholds'),(product_b,org_b,'Other product');
  insert into public.wood_species(id,organization_id,code,name_fi,name_pl,name_en) values
    (oak,org_a,'oak','Tammi','Dąb','Oak'),(birch,org_a,'birch','Koivu','Brzoza','Birch'),
    (foreign_species,org_b,'oak','Tammi','Dąb','Oak');
  insert into public.product_variants(id,organization_id,product_id,variant_code,variant_name,wood_species_id)
    values(variant,org_a,product_a,'THRESHOLD-OAK','Oak threshold',oak);
  perform set_config('request.jwt.claim.sub',admin_user::text,true);
  execute 'set local role authenticated';

  perform public.save_product_wood_species(org_a,product_a,'{}'::uuid[],array[oak,birch]);
  if (select count(*) from public.product_wood_species where organization_id=org_a and product_id=product_a)<>2 then
    raise exception 'FAILED multi-selection persistence';
  end if;
  perform public.save_product_wood_species(org_a,product_a,array[birch,oak],array[oak]);
  begin
    perform public.save_product_wood_species(org_a,product_a,array[oak,birch],'{}'::uuid[]);
    raise exception 'FAILED stale selection';
  exception when serialization_failure then null; end;
  begin
    perform public.save_product_wood_species(org_a,product_a,array[oak],array[oak,foreign_species]);
    raise exception 'FAILED cross-tenant species';
  exception when foreign_key_violation then null; end;
  begin
    perform public.save_product_wood_species(org_a,product_b,'{}'::uuid[],array[oak]);
    raise exception 'FAILED cross-tenant product';
  exception when foreign_key_violation then null; end;
  begin
    perform public.save_product_wood_species(org_a,product_a,array[oak],array[oak,oak]);
    raise exception 'FAILED duplicate selection';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.product_wood_species(organization_id,product_id,wood_species_id) values(org_a,product_a,birch);
    raise exception 'FAILED direct DML grant';
  exception when insufficient_privilege then null; end;

  execute 'reset role';
  update public.wood_species set is_active=false where id in (oak,birch);
  execute 'set local role authenticated';
  -- Retain existing archived selection, but reject adding an archived species.
  perform public.save_product_wood_species(org_a,product_a,array[oak],array[oak]);
  begin
    perform public.save_product_wood_species(org_a,product_a,array[oak],array[oak,birch]);
    raise exception 'FAILED newly archived species';
  exception when foreign_key_violation then null; end;
  perform public.save_product_wood_species(org_a,product_a,array[oak],'{}'::uuid[]);
  if exists(select 1 from public.product_wood_species where organization_id=org_a and product_id=product_a) then
    raise exception 'FAILED clear selection';
  end if;
  if (select count(*) from public.product_variants where organization_id=org_a and product_id=product_a)<>1 or
     not exists(select 1 from public.product_variants where id=variant and wood_species_id=oak) then
    raise exception 'FAILED species selection changed physical variants';
  end if;

  perform public.save_product_wood_species(org_b,product_b,'{}'::uuid[],array[foreign_species]);
  perform set_config('request.jwt.claim.sub',other_user::text,true);
  if exists(select 1 from public.product_wood_species) then raise exception 'FAILED unauthorized RLS read'; end if;
  begin
    perform public.save_product_wood_species(org_a,product_a,'{}'::uuid[],'{}'::uuid[]);
    raise exception 'FAILED unauthorized mutation';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$$;
rollback;
