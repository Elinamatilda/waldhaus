-- DISPOSABLE DATABASE ONLY after the canonical Product Master and
-- 20260928030000_variant_customer_selection.sql migrations. Roll back all fixtures.
begin;
do $$
declare
  u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); org_a uuid:=gen_random_uuid(); org_b uuid:=gen_random_uuid();
  product uuid:=gen_random_uuid(); customer_a uuid:=gen_random_uuid(); customer_b uuid:=gen_random_uuid(); foreign_customer uuid:=gen_random_uuid();
  data jsonb; saved jsonb; snapshot jsonb; link public.customer_products%rowtype; term jsonb; old_variant_version bigint;
begin
  insert into auth.users(id,email) values(u,u::text||'@example.invalid'),(outsider,outsider::text||'@example.invalid');
  update public.profiles set is_system_admin=true,is_active=true where id=u;
  insert into public.organizations(id,name,slug) values(org_a,'Variant customers A',org_a::text),(org_b,'Variant customers B',org_b::text);
  insert into public.products(id,organization_id,name) values(product,org_a,'Thresholds');
  insert into public.customers(id,organization_id,name) values(customer_a,org_a,'Customer A'),(customer_b,org_a,'Customer B'),(foreign_customer,org_b,'Foreign customer');
  perform set_config('request.jwt.claim.sub',u::text,true);
  execute 'set local role authenticated';
  data:=jsonb_build_object('product_id',product,'variant_code','THRESHOLD-130','variant_name','Threshold',
    'wood_species_id',null,'construction_type_id',null,'quality_code',null,
    'thickness_mm','27','width_mm','130','length_mm','3000','default_quantity_unit_code','PIECE','is_active',true);
  saved:=public.save_product_variant_customers(org_a,null,null,data,'[]'::jsonb,array[customer_a],false);
  select * into link from public.customer_products where organization_id=org_a and product_variant_id=(saved->>'id')::uuid;
  if link.customer_id is distinct from customer_a then raise exception 'FAILED selected customer'; end if;
  if not exists(select 1 from public.product_variants where id=(saved->>'id')::uuid and customer_id is null) then
    raise exception 'FAILED physical variant customer independence';
  end if;
  perform public.save_product_master(org_a,'customer_products',link.id,link.edit_version,
    jsonb_build_object('customer_id',customer_a,'product_variant_id',saved->>'id','customer_product_code','REF',
      'customer_product_name','Customer threshold','notes','Keep metadata','is_active',true));
  term:=public.save_product_master(org_a,'customer_product_terms',null,null,
    jsonb_build_object('customer_product_id',link.id,'valid_from','2026-01-01','valid_to',null,
      'demand_quantity',null,'demand_unit_code',null,'demand_period',null,'demand_year',null,
      'unit_price_amount',null,'pricing_basis_code',null,'currency_code',null,'delivery_note',null,'notes','Keep terms','is_active',true));
  select jsonb_agg(jsonb_build_object('id',id,'edit_version',edit_version::text)) into snapshot
    from public.customer_products where organization_id=org_a and product_variant_id=(saved->>'id')::uuid;
  begin
    perform public.save_product_variant_customers(org_a,null,null,data||'{"variant_code":"FAILED-FOREIGN"}','[]'::jsonb,array[foreign_customer],false);
    raise exception 'FAILED cross-tenant customer accepted';
  exception when foreign_key_violation then null; end;
  if exists(select 1 from public.product_variants where organization_id=org_a and variant_code='FAILED-FOREIGN') then
    raise exception 'FAILED partial variant write';
  end if;
  begin
    perform public.save_product_variant_customers(org_a,(saved->>'id')::uuid,(saved->>'edit_version')::bigint,data,'[]'::jsonb,array[customer_a],false);
    raise exception 'FAILED stale customer links accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_product_variant_customers(org_a,(saved->>'id')::uuid,(saved->>'edit_version')::bigint,data,snapshot,'{}'::uuid[],false);
    raise exception 'FAILED removal without confirmation';
  exception when invalid_parameter_value then null; end;

  saved:=public.save_product_variant_customers(org_a,(saved->>'id')::uuid,(saved->>'edit_version')::bigint,data,snapshot,'{}'::uuid[],true);
  if not exists(select 1 from public.customer_products where id=link.id and not is_active and customer_product_code='REF' and notes='Keep metadata') then
    raise exception 'FAILED archived history or metadata';
  end if;
  select jsonb_agg(jsonb_build_object('id',id,'edit_version',edit_version::text)) into snapshot
    from public.customer_products where organization_id=org_a and product_variant_id=(saved->>'id')::uuid;
  saved:=public.save_product_variant_customers(org_a,(saved->>'id')::uuid,(saved->>'edit_version')::bigint,data,snapshot,array[customer_a,customer_b],false);
  if (select count(*) from public.customer_products where organization_id=org_a and product_variant_id=(saved->>'id')::uuid and is_active)<>2 then
    raise exception 'FAILED multi-customer selection';
  end if;
  if not exists(select 1 from public.customer_products where id=link.id and is_active and customer_product_code='REF' and notes='Keep metadata') or
     not exists(select 1 from public.customer_product_terms where id=(term->>'id')::uuid and customer_product_id=link.id and notes='Keep terms') then
    raise exception 'FAILED reactivation lost relationship or terms';
  end if;
  if (select count(*) from public.product_variants where organization_id=org_a)<>1 then raise exception 'FAILED duplicate variant'; end if;
  old_variant_version:=(saved->>'edit_version')::bigint;
  select jsonb_agg(jsonb_build_object('id',id,'edit_version',edit_version::text)) into snapshot
    from public.customer_products where organization_id=org_a and product_variant_id=(saved->>'id')::uuid;
  begin
    perform public.save_product_variant_customers(org_a,(saved->>'id')::uuid,old_variant_version,data||'{"width_mm":"170"}',snapshot,array[customer_a,customer_b],false);
    raise exception 'FAILED referenced dimensions changed';
  exception when check_violation then null; end;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.save_product_variant_customers(org_a,null,null,data,'[]'::jsonb,array[customer_a],false);
    raise exception 'FAILED unauthorized write';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$$;
rollback;
