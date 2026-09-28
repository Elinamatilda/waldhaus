-- Save a physical variant and its selected customer relationships atomically.
-- No new product model or customer_id on product_variants.
begin;
create function public.save_product_variant_customers(
  p_organization uuid, p_id uuid, p_expected_version bigint, p_data jsonb,
  p_expected_links jsonb, p_customer_ids uuid[], p_confirm_archive boolean
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare
  expected_links jsonb;
  current_links jsonb;
  selected_ids uuid[];
  item jsonb;
  saved jsonb;
  variant_id uuid;
  customer_key uuid;
  link public.customer_products%rowtype;
  link_data jsonb;
begin
  if auth.uid() is null or p_organization is null or public.is_organization_admin(p_organization) is not true then
    raise exception using errcode='42501',message='Forbidden';
  end if;
  if jsonb_typeof(p_expected_links) is distinct from 'array' then
    raise exception using errcode='22023',message='Expected customer relationship versions';
  end if;
  if jsonb_array_length(p_expected_links)>100 or p_customer_ids is null or cardinality(p_customer_ids)>100
     or array_ndims(p_customer_ids)>1 or array_position(p_customer_ids,null) is not null then
    raise exception using errcode='22023',message='Invalid customer selection';
  end if;
  for item in select value from jsonb_array_elements(p_expected_links) loop
    if jsonb_typeof(item) is distinct from 'object' then
      raise exception using errcode='22023',message='Invalid relationship version';
    end if;
    if not(item ? 'id' and item ? 'edit_version') or
       exists(select 1 from jsonb_object_keys(item) k where k not in ('id','edit_version')) or
       jsonb_typeof(item->'id') is distinct from 'string' or
       jsonb_typeof(item->'edit_version') is distinct from 'string' or
       (item->>'edit_version') !~ '^[0-9]{1,19}$' then
      raise exception using errcode='22023',message='Invalid relationship version';
    end if;
    perform (item->>'id')::uuid;
    perform (item->>'edit_version')::bigint;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',(value->>'id')::uuid,'edit_version',((value->>'edit_version')::bigint)::text) order by (value->>'id')::uuid),'[]'::jsonb)
    into expected_links from jsonb_array_elements(p_expected_links);
  if (select count(distinct (value->>'id')::uuid) from jsonb_array_elements(expected_links))<>jsonb_array_length(expected_links) then
    raise exception using errcode='22023',message='Duplicate relationship version';
  end if;
  select coalesce(array_agg(distinct id order by id),'{}'::uuid[]) into selected_ids from unnest(p_customer_ids) as ids(id);
  if cardinality(selected_ids)<>cardinality(p_customer_ids) then
    raise exception using errcode='22023',message='Duplicate customer';
  end if;

  -- All relationship writes use save_product_master and the same advisory lock.
  perform pg_advisory_xact_lock(hashtextextended(p_organization::text,682914));
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'edit_version',edit_version::text) order by id),'[]'::jsonb)
    into current_links from public.customer_products where organization_id=p_organization and product_variant_id=p_id;
  if expected_links is distinct from current_links then
    raise exception using errcode='40001',message='Customer relationships changed; refresh before saving';
  end if;
  if p_confirm_archive is not true and exists(
    select 1 from public.customer_products where organization_id=p_organization and product_variant_id=p_id
      and is_active and not(customer_id=any(selected_ids))
  ) then raise exception using errcode='22023',message='Confirm archiving deselected relationships'; end if;

  saved:=public.save_product_master(p_organization,'product_variants',p_id,p_expected_version,p_data);
  variant_id:=(saved->>'id')::uuid;
  foreach customer_key in array selected_ids loop
    select * into link from public.customer_products
      where organization_id=p_organization and product_variant_id=variant_id and customer_id=customer_key;
    if found then
      if not link.is_active then
        link_data:=jsonb_build_object('customer_id',link.customer_id,'product_variant_id',variant_id,
          'customer_product_code',link.customer_product_code,'customer_product_name',link.customer_product_name,'notes',link.notes,'is_active',true);
        perform public.save_product_master(p_organization,'customer_products',link.id,link.edit_version,link_data);
      end if;
    else
      perform public.save_product_master(p_organization,'customer_products',null,null,
        jsonb_build_object('customer_id',customer_key,'product_variant_id',variant_id,
          'customer_product_code',null,'customer_product_name',null,'notes',null,'is_active',true));
    end if;
  end loop;
  for link in select * from public.customer_products
    where organization_id=p_organization and product_variant_id=variant_id and is_active and not(customer_id=any(selected_ids))
  loop
    link_data:=jsonb_build_object('customer_id',link.customer_id,'product_variant_id',variant_id,
      'customer_product_code',link.customer_product_code,'customer_product_name',link.customer_product_name,'notes',link.notes,'is_active',false);
    perform public.save_product_master(p_organization,'customer_products',link.id,link.edit_version,link_data);
  end loop;
  -- Any failure above rolls back variant and relationship changes together.
  return saved;
end;
$$;
revoke all on function public.save_product_variant_customers(uuid,uuid,bigint,jsonb,jsonb,uuid[],boolean) from public,anon;
grant execute on function public.save_product_variant_customers(uuid,uuid,bigint,jsonb,jsonb,uuid[],boolean) to authenticated;
commit;
