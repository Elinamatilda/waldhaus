import 'server-only';
import { requireProductOrganization } from './authorization';
import { createClient } from '@/lib/supabase/server';
import { identifier, masterSaved, MASTER_FIELDS, parseMasterPayload, ProductInputError, versionInput, type MasterEntity, type MasterPayload } from './model';

export { requireProductOrganization } from './authorization';
export { getProductMasterDefinition } from './read-service';
export { getCustomerProductDefinitions } from './read-service';
export type { ProductMasterDefinition } from './read-model';
export async function productMasterReady(organizationId:string) {
  await requireProductOrganization(organizationId);
  const db=await createClient();const {error}=await db.from('wood_species').select('id').eq('organization_id',organizationId).limit(1);
  if(error&&['42P01','PGRST205','42703','PGRST204'].includes(error.code))return false;
  if(error)throw Object.assign(new Error('Product catalogue could not be loaded'),{databaseCode:error.code});
  return true;
}
export type MasterRow=MasterPayload & {id:string;organization_id:string;edit_version:string};

/** Counts include archived variants, so retained product history remains discoverable. */
export async function getProductVariantCounts(org:string,productIds:string[]) {
  await requireProductOrganization(org);
  const ids=[...new Set(productIds.map(id=>identifier(id)!))];
  const counts:Record<string,number>=Object.fromEntries(ids.map(id=>[id,0]));
  const db=await createClient();
  for(let batch=0;batch<ids.length;batch+=100){
    for(let page=0;;page++){
      const {data,error}=await db.from('product_variants').select('id,product_id')
        .eq('organization_id',org).in('product_id',ids.slice(batch,batch+100)).order('id').range(page*200,page*200+199);
      if(error)throw Object.assign(new Error('Variant counts could not be loaded'),{databaseCode:error.code});
      for(const row of data??[])counts[row.product_id]++;
      if(!data||data.length<200)break;
    }
  }
  return counts;
}

export async function loadProductLookups(org:string) {
  const [wood_species,construction_types]=await Promise.all([
    listProductMasters(org,'wood_species'),listProductMasters(org,'construction_types'),
  ]);
  return {wood_species,construction_types};
}
export async function saveProductWoodSpecies(org:string,productId:string,expected:unknown[],selected:unknown[]) {
  await requireProductOrganization(org);
  const product=identifier(productId)!;
  const ids=(values:unknown[])=>{
    if(!Array.isArray(values)||values.length>100)throw new ProductInputError('Invalid species selection');
    const parsed=values.map(value=>identifier(value)!);
    if(new Set(parsed).size!==parsed.length)throw new ProductInputError('Duplicate species');
    return parsed.sort();
  };
  const expectedIds=ids(expected),selectedIds=ids(selected);
  const db=await createClient();
  const {error}=await db.rpc('save_product_wood_species',{
    p_organization:org,p_product:product,p_expected:expectedIds,p_selected:selectedIds,
  });
  if(error)throw Object.assign(new Error('Product species save failed'),{databaseCode:error.code});
}
export async function listProductMasters(organizationId:string,entity:MasterEntity,filter?:{product_id?:string;customer_id?:string;customer_product_id?:string}) {
  await requireProductOrganization(organizationId);
  if(!Object.hasOwn(MASTER_FIELDS,entity))throw new ProductInputError('Unknown entity');
  const db=await createClient();const rows:MasterRow[]=[];
  for(let page=0;;page++){
    let query=db.from(entity).select(`id,organization_id,edit_version::text,${Object.entries(MASTER_FIELDS[entity]).map(([key,kind])=>kind==='numeric'||kind==='dimension'?`${key}::text`:key).join(',')}`).eq('organization_id',organizationId).order('id').range(page*200,page*200+199);
    for(const [key,value] of Object.entries(filter??{})){
      if(!Object.hasOwn(MASTER_FIELDS[entity],key))throw new ProductInputError('Invalid filter');query=query.eq(key,identifier(value)!);
    }
    const {data,error}=await query;
    if(error)throw Object.assign(new Error('Product catalogue could not be loaded'),{databaseCode:error.code});
    rows.push(...(data??[]) as unknown as MasterRow[]);if(!data||data.length<200)break;
  }
  return rows;
}
export async function getProductMaster(organizationId:string,entity:MasterEntity,id:string):Promise<MasterRow|null> {
  await requireProductOrganization(organizationId);identifier(id);
  if(!Object.hasOwn(MASTER_FIELDS,entity))throw new ProductInputError('Unknown entity');
  const db=await createClient();const {data,error}=await db.from(entity).select(`id,organization_id,edit_version::text,${Object.entries(MASTER_FIELDS[entity]).map(([key,kind])=>kind==='numeric'||kind==='dimension'?`${key}::text`:key).join(',')}`).eq('organization_id',organizationId).eq('id',id).maybeSingle();
  if(error)throw Object.assign(new Error('Product master could not be loaded'),{databaseCode:error.code});
  return data as unknown as MasterRow|null;
}
export async function saveProductMaster(organizationId:string,entity:MasterEntity,id:string|null,expectedVersion:string|null,payload:unknown) {
  await requireProductOrganization(organizationId);
  const data=parseMasterPayload(entity,payload);const recordId=identifier(id,true);const expected=versionInput(expectedVersion);
  if((recordId===null)!==(expected===null))throw new ProductInputError('Expected version required only for existing records');
  const db=await createClient();const result=await db.rpc('save_product_master',{p_organization:organizationId,p_entity:entity,p_id:recordId,p_expected_version:expected,p_data:data});
  if(result.error)throw Object.assign(new Error('Product master save failed'),{databaseCode:result.error.code});
  return masterSaved(result.data);
}
export const createProductVariant=(org:string,data:unknown)=>saveProductMaster(org,'product_variants',null,null,data);
export const updateProductVariant=(org:string,id:string,version:string,data:unknown)=>saveProductMaster(org,'product_variants',id,version,data);
export const listProductVariants=(org:string,productId?:string)=>listProductMasters(org,'product_variants',productId?{product_id:productId}:undefined);
export const getProductVariant=(org:string,id:string)=>getProductMaster(org,'product_variants',id);
export const createCustomerProduct=(org:string,data:unknown)=>saveProductMaster(org,'customer_products',null,null,data);
export const updateCustomerProduct=(org:string,id:string,version:string,data:unknown)=>saveProductMaster(org,'customer_products',id,version,data);
export const createCustomerProductTerms=(org:string,data:unknown)=>saveProductMaster(org,'customer_product_terms',null,null,data);
export const updateCustomerProductTerms=(org:string,id:string,version:string,data:unknown)=>saveProductMaster(org,'customer_product_terms',id,version,data);
export async function archiveProductMaster(org:string,entity:MasterEntity,id:string,version:string) {
  const row=await getProductMaster(org,entity,id);
  if(!row)throw Object.assign(new Error('Not found'),{databaseCode:'P0002'});
  const payload=Object.fromEntries(Object.keys(MASTER_FIELDS[entity]).map(key=>[key,row[key]]));
  return saveProductMaster(org,entity,id,version,{...payload,is_active:false});
}
export const archiveProductVariant=(org:string,id:string,version:string)=>archiveProductMaster(org,'product_variants',id,version);
export const archiveCustomerProduct=(org:string,id:string,version:string)=>archiveProductMaster(org,'customer_products',id,version);
export async function findVariantCandidates(org:string,payload:unknown) {
  const data=parseMasterPayload('product_variants',payload);
  const rows=await listProductVariants(org,String(data.product_id));
  // Candidate warning only: quality/profile/revision may legitimately differ.
  return rows.filter(row=>['wood_species_id','construction_type_id','thickness_mm','width_mm','length_mm'].every(key=>
    row[key]===null?data[key]===null:key.endsWith('_mm')?data[key]!==null&&Number(row[key])===Number(data[key]):row[key]===data[key]
  ));
}
export async function loadProductWorkspace(org:string,productId:string) {
  if(!await productMasterReady(org))return null;
  const [wood_species,construction_types,product_variants,allRelationships,allTerms]=await Promise.all([
    listProductMasters(org,'wood_species'),listProductMasters(org,'construction_types'),listProductVariants(org,productId),
    listProductMasters(org,'customer_products'),listProductMasters(org,'customer_product_terms'),
  ]);
  const variants=new Set(product_variants.map(row=>row.id));
  const customer_products=allRelationships.filter(row=>variants.has(String(row.product_variant_id)));
  const relationships=new Set(customer_products.map(row=>row.id));
  return {wood_species,construction_types,product_variants,customer_products,customer_product_terms:allTerms.filter(row=>relationships.has(String(row.customer_product_id)))};
}

/** Customer-specific choices come from commercial relationships, never variant.customer_id.
 * Before Product Master deployment there are no canonical customer relationships to offer.
 * Existing Sales snapshots and product-level entries retain their existing RPC contract.
 */
export async function listCustomerProductVariants(org:string,productId:string,customerId:string) {
  identifier(productId);identifier(customerId);
  if(!await productMasterReady(org))return [];
  const [variants,relationships]=await Promise.all([
    listProductVariants(org,productId),listProductMasters(org,'customer_products',{customer_id:customerId}),
  ]);
  const linked=new Set(relationships.filter(row=>row.is_active).map(row=>row.product_variant_id));
  return variants.filter(row=>row.is_active&&linked.has(row.id));
}
