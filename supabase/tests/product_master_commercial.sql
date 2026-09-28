-- DISPOSABLE DATABASE ONLY after separately approved migration. No schema changes.
-- Rolled-back fixture data; no live deployment has been performed by the agent.
begin;
do $$
declare
 u uuid:=gen_random_uuid(); org_a uuid:=gen_random_uuid(); org_b uuid:=gen_random_uuid();
 product uuid:=gen_random_uuid(); customer uuid:=gen_random_uuid(); customer_b uuid:=gen_random_uuid();
 species jsonb; variant jsonb; relation jsonb; terms jsonb; data jsonb; result jsonb;
 inactive_product uuid:=gen_random_uuid(); inactive_customer uuid:=gen_random_uuid();
 inactive_species jsonb; inactive_construction jsonb; inactive_variant jsonb; inactive_relation jsonb;
 species_b jsonb; field text; invalid_parent jsonb; relation_data jsonb; historical_relation jsonb; historical_data jsonb;
begin
 insert into auth.users(id,email) values(u,u::text||'@example.invalid');
 update public.profiles set is_system_admin=true,is_active=true where id=u;
 insert into public.organizations(id,name,slug) values(org_a,'Product test A',org_a::text),(org_b,'Product test B',org_b::text);
 insert into public.products(id,organization_id,name) values(product,org_a,'Threshold');
 insert into public.customers(id,organization_id,name) values(customer,org_a,'Customer A'),(customer_b,org_b,'Customer B');
 insert into public.products(id,organization_id,name,is_active) values(inactive_product,org_a,'Archived product',false);
 insert into public.customers(id,organization_id,name,is_active) values(inactive_customer,org_a,'Archived customer',false);
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 species:=public.save_product_master(org_a,'wood_species',null,null,jsonb_build_object('code','oak','name_fi','Tammi','name_pl','Dąb','name_en','Oak','scientific_name',null,'is_active',true));
 inactive_species:=public.save_product_master(org_a,'wood_species',null,null,jsonb_build_object('code','old','name_fi','Vanha','name_pl','Stary','name_en','Old','scientific_name',null,'is_active',false));
 inactive_construction:=public.save_product_master(org_a,'construction_types',null,null,jsonb_build_object('code','old','name_fi','Vanha','name_pl','Stary','name_en','Old','is_active',false));
 species_b:=public.save_product_master(org_b,'wood_species',null,null,jsonb_build_object('code','other','name_fi','Muu','name_pl','Inny','name_en','Other','scientific_name',null,'is_active',true));
 data:=jsonb_build_object('product_id',product,'variant_code','THRESHOLD-130','variant_name','Threshold 130','wood_species_id',species->>'id','construction_type_id',null,'quality_code',null,'thickness_mm','27','width_mm','130','length_mm','3000','default_quantity_unit_code','PIECE','is_active',true);
 variant:=public.save_product_master(org_a,'product_variants',null,null,data);
 if not exists(select 1 from public.product_variants where id=(variant->>'id')::uuid and customer_id is null and volume_per_unit_m3 is null and thickness_mm=27 and width_mm=130 and length_mm=3000) then raise exception 'FAILED physical source persistence'; end if;
 -- Reject legacy customer coupling in the RPC even when the customer belongs to this org.
 begin
   perform public.save_product_master(org_a,'product_variants',null,null,data||jsonb_build_object('customer_id',customer));
   raise exception 'FAILED customer-scoped variant payload';
 exception when invalid_parameter_value then null; end;
 -- Active-child checks cover every optional/required variant parent on both create and update.
 foreach field in array array['product_id','wood_species_id','construction_type_id'] loop
   invalid_parent:=case field when 'product_id' then to_jsonb(inactive_product::text)
     when 'wood_species_id' then inactive_species->'id' else inactive_construction->'id' end;
   begin
     perform public.save_product_master(org_a,'product_variants',null,null,jsonb_set(data||'{"variant_code":"INACTIVE-PARENT"}',array[field],invalid_parent));
     raise exception 'FAILED inactive variant parent on create: %',field;
   exception when foreign_key_violation then null; end;
   begin
     perform public.save_product_master(org_a,'product_variants',(variant->>'id')::uuid,(variant->>'edit_version')::bigint,jsonb_set(data,array[field],invalid_parent));
     raise exception 'FAILED inactive variant parent on update: %',field;
   exception when foreign_key_violation then null;
     when check_violation then
       -- Product identity is independently immutable on update.
       if field<>'product_id' then raise; end if;
   end;
 end loop;
 begin
   perform public.save_product_master(org_a,'product_variants',null,null,data||jsonb_build_object('variant_code','OTHER-SPECIES','wood_species_id',species_b->>'id'));
   raise exception 'FAILED cross-tenant species';
 exception when foreign_key_violation then null; end;
 begin
   perform public.save_product_master(org_a,'product_variants',null,null,data||'{"variant_code":"BAD-UOM","default_quantity_unit_code":"mb"}');
   raise exception 'FAILED noncanonical UOM';
 exception when invalid_parameter_value then null; end;
 inactive_variant:=public.save_product_master(org_a,'product_variants',null,null,data||jsonb_build_object('variant_code','ARCHIVED','product_id',inactive_product,'wood_species_id',inactive_species->>'id','construction_type_id',inactive_construction->>'id','is_active',false));
 -- Database customer-independent CHECK also protects privileged non-RPC writes.
 execute 'reset role';
 begin
   update public.product_variants set customer_id=customer where id=(variant->>'id')::uuid;
   raise exception 'FAILED database customer-independent constraint';
 exception when check_violation then null; end;
 begin
   update public.product_variants set default_quantity_unit_code='mb' where id=(variant->>'id')::uuid;
   raise exception 'FAILED database UOM FK';
 exception when foreign_key_violation then null; end;
 execute 'set local role authenticated';
 begin
   perform public.save_product_master(org_b,'product_variants',null,null,data);
   raise exception 'FAILED cross-tenant product reference';
 exception when foreign_key_violation then null; end;
 begin
   perform public.save_product_master(org_a,'product_variants',null,null,data);
   raise exception 'FAILED duplicate variant code';
 exception when unique_violation then null; end;
 begin
   perform public.save_product_master(org_a,'product_variants',null,null,jsonb_set(data,'{width_mm}','"invalid"'));
   raise exception 'FAILED malformed dimension';
 exception when invalid_parameter_value then null; end;
 begin
   insert into public.product_variants(organization_id,product_id) values(org_a,product);
   raise exception 'FAILED direct variant insert';
 exception when insufficient_privilege then null; end;
 relation_data:=jsonb_build_object('customer_id',customer,'product_variant_id',variant->>'id','customer_product_code',null,'customer_product_name',null,'notes','source percentages unresolved','is_active',true);
 relation:=public.save_product_master(org_a,'customer_products',null,null,relation_data);
 begin
   perform public.save_product_master(org_a,'customer_products',null,null,relation_data||jsonb_build_object('customer_id',inactive_customer));
   raise exception 'FAILED inactive customer';
 exception when foreign_key_violation then null; end;
 begin
   perform public.save_product_master(org_a,'customer_products',null,null,relation_data||jsonb_build_object('product_variant_id',inactive_variant->>'id'));
   raise exception 'FAILED inactive variant';
 exception when foreign_key_violation then null; end;
 begin
   perform public.save_product_master(org_a,'customer_products',null,null,relation_data||jsonb_build_object('customer_id',customer_b));
   raise exception 'FAILED cross-tenant customer';
 exception when foreign_key_violation then null; end;
 inactive_relation:=public.save_product_master(org_a,'customer_products',null,null,relation_data||jsonb_build_object('customer_id',inactive_customer,'product_variant_id',inactive_variant->>'id','is_active',false));
 -- Reactivation must validate the unchanged identity references too: test each parent independently.
 foreach field in array array['customer_id','product_variant_id'] loop
   historical_data:=relation_data||jsonb_build_object('is_active',false)||
     case field when 'customer_id' then jsonb_build_object(field,inactive_customer)
       else jsonb_build_object(field,inactive_variant->>'id') end;
   historical_relation:=public.save_product_master(org_a,'customer_products',null,null,historical_data);
   begin
     perform public.save_product_master(org_a,'customer_products',(historical_relation->>'id')::uuid,
       (historical_relation->>'edit_version')::bigint,historical_data||'{"is_active":true}');
     raise exception 'FAILED relationship reactivation with inactive parent: %',field;
   exception when foreign_key_violation then null; end;
 end loop;
 begin
   perform public.save_product_master(org_a,'product_variants',(variant->>'id')::uuid,(variant->>'edit_version')::bigint,jsonb_set(data,'{width_mm}','"170"'));
   raise exception 'FAILED mutation of referenced physical identity';
 exception when check_violation then null; end;
 data:=data||'{"variant_name":"Updated display name"}';
 variant:=public.save_product_master(org_a,'product_variants',(variant->>'id')::uuid,(variant->>'edit_version')::bigint,data);
 if not exists(select 1 from public.product_variants where id=(variant->>'id')::uuid and variant_name='Updated display name') then raise exception 'FAILED display-only update'; end if;
 terms:=jsonb_build_object('customer_product_id',relation->>'id','valid_from','2026-01-01','valid_to','2026-12-31','demand_quantity','1500','demand_unit_code','PIECE','demand_period','YEAR','demand_year',2026,'unit_price_amount','10.44','pricing_basis_code','PER_PIECE','currency_code','EUR','delivery_note',null,'notes',null,'is_active',true);
 begin
   perform public.save_product_master(org_a,'customer_product_terms',null,null,terms||jsonb_build_object('customer_product_id',inactive_relation->>'id'));
   raise exception 'FAILED inactive customer product';
 exception when foreign_key_violation then null; end;
 perform public.save_product_master(org_a,'customer_product_terms',null,null,terms||jsonb_build_object('customer_product_id',inactive_relation->>'id','is_active',false));
 result:=public.save_product_master(org_a,'customer_product_terms',null,null,terms);
 begin
   perform public.save_product_master(org_b,'customer_product_terms',null,null,terms);
   raise exception 'FAILED cross-tenant commercial parent';
 exception when foreign_key_violation then null; end;
 begin
   perform public.save_product_master(org_a,'customer_product_terms',null,null,terms);
   raise exception 'FAILED overlapping commercial terms';
 exception when check_violation then null; end;
 begin
   perform public.save_product_master(org_a,'customer_product_terms',null,null,terms||'{"valid_from":"2026-12-31","valid_to":"2027-12-31","demand_year":2027}');
   raise exception 'FAILED inclusive boundary overlap';
 exception when check_violation then null; end;
 -- Adjacent, nonoverlapping intervals are allowed; existing interval remains unchanged.
 perform public.save_product_master(org_a,'customer_product_terms',null,null,terms||'{"valid_from":"2027-01-01","valid_to":"2027-12-31","demand_year":2027}');
 begin
   perform public.save_product_master(org_a,'customer_product_terms',(result->>'id')::uuid,0,terms);
   raise exception 'FAILED stale commercial edit';
 exception when serialization_failure then null; end;
 perform public.save_product_master(org_a,'customer_product_terms',(result->>'id')::uuid,(result->>'edit_version')::bigint,jsonb_set(terms,'{is_active}','false'));
 -- Explicit zero price stays zero; missing price remains NULL when all related fields absent.
 terms:=jsonb_set(terms,'{unit_price_amount}','"0"');
 result:=public.save_product_master(org_a,'customer_product_terms',null,null,terms);
 if not exists(select 1 from public.customer_product_terms where id=(result->>'id')::uuid and unit_price_amount=0 and demand_quantity=1500) then raise exception 'FAILED zero preservation'; end if;
 -- Archiving a parent preserves historical children; active child writes then fail.
 relation:=public.save_product_master(org_a,'customer_products',(relation->>'id')::uuid,(relation->>'edit_version')::bigint,relation_data||'{"is_active":false}');
 if not exists(select 1 from public.customer_product_terms where id=(result->>'id')::uuid and is_active) then raise exception 'FAILED cascading archive of terms'; end if;
 begin
   perform public.save_product_master(org_a,'customer_product_terms',(result->>'id')::uuid,(result->>'edit_version')::bigint,terms);
   raise exception 'FAILED active term update with inactive relationship';
 exception when foreign_key_violation then null; end;
 perform public.save_product_master(org_a,'customer_product_terms',(result->>'id')::uuid,(result->>'edit_version')::bigint,terms||'{"is_active":false}');
 execute 'reset role';
 update public.profiles set is_system_admin=false where id=u;
 insert into public.organization_members(organization_id,user_id,role_id,is_active) select org_a,u,id,true from public.roles where scope='ORGANIZATION' and code='ADMIN';
 execute 'set local role authenticated';
 perform public.save_product_master(org_a,'wood_species',null,null,jsonb_build_object('code','admin_own','name_fi','Oma','name_pl','Własny','name_en','Own','scientific_name',null,'is_active',true));
 begin
   perform public.save_product_master(org_b,'wood_species',null,null,jsonb_build_object('code','oak','name_fi','Tammi','name_pl','Dąb','name_en','Oak','scientific_name',null,'is_active',true));
   raise exception 'FAILED Admin tenant boundary';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
 update public.organization_members set role_id=(select id from public.roles where scope='ORGANIZATION' and code='EMPLOYEE') where user_id=u;
 execute 'set local role authenticated';
 if exists(select 1 from public.customer_product_terms where organization_id=org_a) then raise exception 'FAILED Employee read'; end if;
 begin
   perform public.save_product_master(org_a,'wood_species',null,null,jsonb_build_object('code','birch','name_fi','Koivu','name_pl','Brzoza','name_en','Birch','scientific_name',null,'is_active',true));
   raise exception 'FAILED Employee write';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
end; $$;
select jsonb_pretty(jsonb_build_object('result','passed','fixture','rolled back below')) as report;
rollback;
