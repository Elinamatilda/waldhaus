import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {loadModule} from '../auth/load-module.mjs';
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const org=uid(1),productId=uid(2),variantId=uid(3),speciesId=uid(4),constructionId=uid(5),customerId=uid(6),linkId=uid(7);
const audit=id=>({id,organization_id:org,is_active:true,archived_at:null,created_by:uid(90),updated_by:uid(91),created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-02T00:00:00Z'});
function dataset(){
 const term=(id,from,to,active=true)=>({...audit(uid(id)),edit_version:'9007199254740993',customer_product_id:linkId,valid_from:from,valid_to:to,is_active:active,demand_quantity:'1500.000000',demand_unit_code:'PIECE',demand_period:'YEAR',demand_year:2026,unit_price_amount:'10.440000',pricing_basis_code:'PER_PIECE',currency_code:'EUR',delivery_note:'Co drugi miesiąc',notes:null});
 return {
  products:[{...audit(productId),product_code:'THRESHOLD',name:'Threshold',description:'Original description'}],
  product_variants:[{...audit(variantId),product_id:productId,variant_code:'THRESHOLD-130',variant_name:'Threshold 130',edit_version:'9007199254740993',wood_species_id:speciesId,construction_type_id:constructionId,quality_code:'I / source value',quality_label_raw:'Jakość źródłowa',thickness_mm:'27.000',width_mm:'130.000',length_mm:'3000.000',depth_mm:'99.000',volume_per_unit_m3:'0.900000',default_quantity_unit_code:'PIECE'}],
  wood_species:[{...audit(speciesId),edit_version:'1',code:'oak',name_fi:'Tammi',name_pl:'Dąb',name_en:'Oak',scientific_name:'Quercus'}],
  construction_types:[{...audit(constructionId),edit_version:'2',code:'solid',name_fi:'Massiivipuu',name_pl:'Lite drewno',name_en:'Solid'}],
  customers:[{...audit(customerId),customer_code:'C1',name:'Customer',notes:'Original customer note'}],
  customer_products:[{...audit(linkId),edit_version:'3',customer_id:customerId,product_variant_id:variantId,customer_product_code:'REF',customer_product_name:'Customer threshold',notes:'Original relationship note'}],
  customer_product_terms:[term(8,'2026-01-01','2026-12-31'),term(9,'2025-01-01','2025-12-31'),term(10,'2027-01-01',null),term(11,'2026-01-01',null,false)],
  units_of_measure:[{code:'PIECE',name_fi:'kpl',name_pl:'szt.',name_en:'pcs'}],
 };
}
function fixture({data=dataset(),context={role:'admin',isSystemAdmin:false,selectedOrganizationId:org},errorTable=null}={}){
 const requests=[];
 const client=createClient('https://example.invalid','test',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  assert.equal(init.method,'GET');const url=new URL(input);requests.push(url);
  const table=url.pathname.split('/').at(-1);
  if(table===errorTable)return Response.json({code:'42P01',message:'Missing schema'},{status:404});
  if(table!=='units_of_measure')assert.equal(url.searchParams.get('organization_id'),`eq.${org}`);
  let rows=data[table]??[];
  for(const [field,filter] of url.searchParams){
   if(filter.startsWith('eq.'))rows=rows.filter(row=>row[field]===filter.slice(3));
   if(filter.startsWith('in.')){
    const ids=filter.slice(4,-1).split(',');rows=rows.filter(row=>ids.includes(row[field]));
   }
  }
  rows=[...rows].sort((a,b)=>(a.id??a.code).localeCompare(b.id??b.code));
  const start=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);
  const columns=url.searchParams.get('select').split(',').map(field=>field.split('::')[0]);
  return Response.json(rows.slice(start,start+limit).map(row=>Object.fromEntries(columns.map(column=>[column,row[column]]))));
 }}});
 const service=loadModule('src/lib/products/service.ts',{
  '@/lib/auth/session':{requireRole:async role=>assert.equal(role,'admin')},
  '@/lib/organization-context':{getOrganizationContext:async()=>context},
  '@/lib/supabase/server':{createClient:async()=>client},
 });
 return {service,requests,data};
}

test('canonical authorized path returns all product fields and joins physical definition separately from commerce',async()=>{
 const h=fixture();const result=await h.service.getProductMasterDefinition(org,productId,'fi','2026-09-26');
 assert.deepEqual(result.product,h.data.products[0]);assert.equal(result.as_of,'2026-09-26');
 const variant=result.variants[0];
 assert.equal(variant.product_id,productId);assert.equal(variant.edit_version,'9007199254740993');
 assert.equal(variant.wood_species.name,'Tammi');assert.equal(variant.wood_species.code,'oak');assert.equal(variant.construction_type.name,'Massiivipuu');
 assert.deepEqual(variant.dimensions,{thickness_mm:'27.000',width_mm:'130.000',length_mm:'3000.000'});
 assert.equal(variant.theoretical_volume_m3,'0.01053');assert.equal(variant.quality_code,'I / source value');assert.equal(variant.quality_label_raw,'Jakość źródłowa');
 assert.deepEqual(variant.legacy_specification,{depth_mm:'99.000',volume_per_unit_m3:'0.900000'});
 assert.equal(variant.default_quantity_unit.name,'kpl');assert.ok(!Object.hasOwn(variant,'customer_id'));assert.ok(!Object.hasOwn(variant,'unit_price_amount'));
 const relationship=variant.related.customer_products[0];assert.equal(relationship.customer.name,'Customer');assert.equal(relationship.customer_product_code,'REF');
 assert.equal(relationship.terms.length,4);assert.equal(relationship.current_terms.length,1);
 assert.equal(relationship.current_terms[0].unit_price_amount,'10.440000');assert.equal(relationship.current_terms[0].demand_unit.name,'kpl');assert.equal(relationship.current_terms[0].delivery_note,'Co drugi miesiąc');
 assert.ok(h.requests.every(url=>!url.pathname.includes('/rpc/')));
});

test('localized classifications use FI/PL/EN without translating source notes, raw quality, or identities',async()=>{
 for(const [locale,name,unit] of [['fi','Tammi','kpl'],['pl','Dąb','szt.'],['en','Oak','pcs']]){
  const {service}=fixture();const variant=(await service.getProductMasterDefinition(org,productId,locale,'2026-12-31')).variants[0];
  assert.equal(variant.wood_species.name,name);assert.equal(variant.wood_species.name_pl,'Dąb');assert.equal(variant.wood_species.id,speciesId);
  assert.equal(variant.default_quantity_unit.name,unit);assert.equal(variant.quality_label_raw,'Jakość źródłowa');
  assert.equal(variant.related.customer_products[0].current_terms[0].id,uid(8));
 }
});
test('missing canonical length never falls back to depth or stored volume; optional lookups remain null',async()=>{
 const data=dataset();Object.assign(data.product_variants[0],{length_mm:null,wood_species_id:null,construction_type_id:null,default_quantity_unit_code:null});
 const h=fixture({data});const variant=(await h.service.getProductMasterDefinition(org,productId,'en')).variants[0];
 assert.equal(variant.dimensions.length_mm,null);assert.equal(variant.theoretical_volume_m3,null);
 assert.equal(variant.legacy_specification.depth_mm,'99.000');assert.equal(variant.wood_species,null);assert.equal(variant.construction_type,null);
});
test('archived records remain available while current terms require active related records',async()=>{
 for(const table of ['products','product_variants','customers','customer_products']){
  const data=dataset();data[table][0].is_active=false;data[table][0].archived_at='2026-09-01T00:00:00Z';
  const result=await fixture({data}).service.getProductMasterDefinition(org,productId,'en','2026-09-26');
  assert.equal(result.variants.length,1);const link=result.variants[0].related.customer_products[0];assert.equal(link.terms.length,4);assert.equal(link.current_terms.length,0);
 }
});
test('effective date selects future/open-ended terms without dropping history',async()=>{
 const {service}=fixture();const result=await service.getProductMasterDefinition(org,productId,'en','2027-01-01');
 assert.equal(result.variants[0].related.customer_products[0].current_terms[0].id,uid(10));
});
test('Employee, wrong tenant, and unselected System Admin fail before any database access',async()=>{
 for(const context of [{role:'employee',isSystemAdmin:false,selectedOrganizationId:org},{role:'admin',isSystemAdmin:false,selectedOrganizationId:uid(99)},{role:'system_admin',isSystemAdmin:true,selectedOrganizationId:null}]){
  const h=fixture({context});await assert.rejects(h.service.getProductMasterDefinition(org,productId,'en'),e=>e.databaseCode==='42501');assert.equal(h.requests.length,0);
 }
 const h=fixture({context:{role:'system_admin',isSystemAdmin:true,selectedOrganizationId:org}});
 assert.ok(await h.service.getProductMasterDefinition(org,productId,'en'));
});
test('missing product is null; missing schema, broken references and cross-tenant references fail explicitly',async()=>{
 const h=fixture();assert.equal(await h.service.getProductMasterDefinition(org,uid(99),'en'),null);assert.equal(h.requests.length,1);
 await assert.rejects(fixture({errorTable:'product_variants'}).service.getProductMasterDefinition(org,productId,'en'),e=>e.databaseCode==='42P01');
 for(const table of ['wood_species','customers']){
  const data=dataset();data[table][0].organization_id=uid(99);
  await assert.rejects(fixture({data}).service.getProductMasterDefinition(org,productId,'en'),e=>e.databaseCode==='23503');
 }
});
test('invalid identifiers, locale and effective dates fail before database reads',async()=>{
 for(const [id,locale,date] of [['bad-id','en','2026-09-26'],[productId,'de','2026-09-26'],[productId,'en','2026-02-30']]){
  const h=fixture();await assert.rejects(h.service.getProductMasterDefinition(org,id,locale,date));assert.equal(h.requests.length,0);
 }
});
test('unrelated products and tenant records are not included in the definition',async()=>{
 const data=dataset();
 data.product_variants.push({...data.product_variants[0],id:uid(100),product_id:uid(101)});
 data.product_variants.push({...data.product_variants[0],id:uid(102),organization_id:uid(103)});
 data.customer_products.push({...data.customer_products[0],id:uid(104),product_variant_id:uid(100)});
 const result=await fixture({data}).service.getProductMasterDefinition(org,productId,'en');
 assert.deepEqual(result.variants.map(v=>v.id),[variantId]);
 assert.deepEqual(result.variants[0].related.customer_products.map(link=>link.id),[linkId]);
});
test('variants, relationships and terms paginate and batch without silently losing later records',async()=>{
 const data=dataset();const v=data.product_variants[0],link=data.customer_products[0],term=data.customer_product_terms[0];
 data.product_variants=Array.from({length:205},(_,i)=>({...v,id:uid(1000+i),variant_code:`V-${i}`}));
 data.customer_products=data.product_variants.map((variant,i)=>({...link,id:uid(2000+i),product_variant_id:variant.id}));
 data.customer_product_terms=data.customer_products.map((relationship,i)=>({...term,id:uid(3000+i),customer_product_id:relationship.id}));
 const result=await fixture({data}).service.getProductMasterDefinition(org,productId,'en','2026-09-26');
 assert.equal(result.variants.length,205);assert.ok(result.variants.every(variant=>variant.related.customer_products.length===1&&variant.related.customer_products[0].current_terms.length===1));
});
test('read projections cover the observed schema, except explicitly deprecated physical customer coupling',()=>{
 const snapshot=JSON.parse(readFileSync('docs/database/deployed-schema-observation-2026-09-25.json','utf8'));
 const {PRODUCT_READ_COLUMNS}=loadModule('src/lib/products/read-model.ts');
 for(const table of ['products','product_variants']){
  const columns=PRODUCT_READ_COLUMNS[table].split(',').map(field=>field.split('::')[0]);
  const observed=snapshot.tables_columns_rls_grants.find(row=>row.table===table).columns.map(column=>column.name);
  for(const field of observed){if(table==='product_variants'&&field==='customer_id')continue;assert.ok(columns.includes(field),`${table}.${field} omitted`);}
  if(table==='product_variants')assert.ok(!columns.includes('customer_id'));
 }
});

test('reverse customer view reuses complete definitions and excludes other customer relationships',async()=>{
 const data=dataset();const otherCustomer=uid(71);
 data.customers.push({...data.customers[0],id:otherCustomer,name:'Other customer'});
 data.customer_products.push({...data.customer_products[0],id:uid(72),customer_id:otherCustomer});
 const {service,requests}=fixture({data});
 const result=await service.getCustomerProductDefinitions(org,customerId,'fi','2026-09-26');
 assert.equal(result.length,1);assert.equal(result[0].product.id,productId);
 assert.equal(result[0].variants[0].theoretical_volume_m3,'0.01053');
 assert.deepEqual(result[0].variants[0].related.customer_products.map(row=>row.customer_id),[customerId]);
 assert.equal(result[0].variants[0].related.customer_products[0].current_terms.length,1);
 assert.ok(requests.some(url=>url.searchParams.get('customer_id')===`eq.${customerId}`));
});
test('reverse reads and counts authorize before accessing any data',async()=>{
 const {service,requests}=fixture({context:{role:'employee',isSystemAdmin:false,selectedOrganizationId:org}});
 await assert.rejects(service.getCustomerProductDefinitions(org,customerId,'en'));
 await assert.rejects(service.getProductVariantCounts(org,[productId]));
 assert.equal(requests.length,0);
});
test('variant counts page through all variants, include archives and preserve zero-count products',async()=>{
 const data=dataset();
 data.product_variants=Array.from({length:205},(_,i)=>({...data.product_variants[0],id:uid(100+i),is_active:i%2===0}));
 const emptyProduct=uid(400);
 const {service,requests}=fixture({data});
 const counts=await service.getProductVariantCounts(org,[productId,emptyProduct]);
 assert.deepEqual(counts,{[productId]:205,[emptyProduct]:0});
 assert.equal(requests.length,2);
 assert.ok(requests.every(url=>url.searchParams.get('select')==='id,product_id'));
});

test('offered product species are independent of physical variants and scoped to the product',async()=>{
 const data=dataset();const birchId=uid(81);
 data.wood_species.push({...data.wood_species[0],id:birchId,code:'birch',name_fi:'Koivu',name_pl:'Brzoza',name_en:'Birch'});
 data.product_wood_species=[{id:uid(82),organization_id:org,product_id:productId,wood_species_id:speciesId},{id:uid(83),organization_id:org,product_id:productId,wood_species_id:birchId},{id:uid(84),organization_id:org,product_id:uid(99),wood_species_id:birchId}];
 const {service}=fixture({data});
 const result=await service.getProductMasterDefinition(org,productId,'fi');
 assert.deepEqual(result.offered_wood_species.map(row=>row.name),['Tammi','Koivu']);
 assert.equal(result.variants.length,1);assert.equal(result.variants[0].wood_species.id,speciesId);
 data.product_variants=[];
 const empty=await fixture({data}).service.getProductMasterDefinition(org,productId,'pl');
 assert.deepEqual(empty.offered_wood_species.map(row=>row.name),['Dąb','Brzoza']);assert.equal(empty.variants.length,0);
});
test('missing product species migration is explicit, while existing master details still load',async()=>{
 const {service}=fixture({errorTable:'product_wood_species'});
 const result=await service.getProductMasterDefinition(org,productId,'en');
 assert.equal(result.offered_wood_species,null);assert.equal(result.variants.length,1);
});
