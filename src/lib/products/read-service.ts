import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isAppLocale, type AppLocale } from '@/lib/i18n/config';
import { requireProductOrganization } from './authorization';
import { identifier, ProductInputError } from './model';
import { theoreticalVolumePerPiece } from './calculations';
import { PRODUCT_READ_COLUMNS, type ProductReadRecords, type UnitRecord, type ProductMasterDefinition } from './read-model';

/** One authorized read path for the complete definition; no UI joins required. */
export async function getProductMasterDefinition(
  organizationId:string,productId:string,locale:AppLocale,asOf=new Date().toISOString().slice(0,10),
):Promise<ProductMasterDefinition|null> {
  await requireProductOrganization(organizationId);
  const productKey=identifier(productId)!;
  if(!isAppLocale(locale)||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||new Date(asOf).toISOString().slice(0,10)!==asOf)throw new ProductInputError('Invalid locale or effective date');
  const db=await createClient();
  const fail=(code:string):never=>{throw Object.assign(new Error('Complete product definition could not be loaded'),{databaseCode:code});};
  const unique=(values:(string|null)[])=>[...new Set(values.filter((id):id is string=>id!==null))];

  async function read<T extends keyof ProductReadRecords>(table:T,column:'id'|'product_id'|'product_variant_id'|'customer_product_id',ids:string[]):Promise<ProductReadRecords[T][]> {
    const result:ProductReadRecords[T][]=[];
    // Bounded IN lists and top-level pagination prevent nested-relation truncation.
    const keys=unique(ids);
    for(let batch=0;batch<keys.length;batch+=100){
      const subset=keys.slice(batch,batch+100);
      for(let page=0;;page++){
        const {data,error}=await db.from(table).select(PRODUCT_READ_COLUMNS[table])
          .eq('organization_id',organizationId).in(column,subset).order('id').range(page*200,page*200+199);
        if(error)fail(error.code);
        const rows=(data??[]) as unknown as ProductReadRecords[T][];
        if(rows.some(row=>row.organization_id!==organizationId))fail('42501');
        result.push(...rows);
        if(rows.length<200)break;
      }
    }
    return result;
  }
  function reference<T>(records:Map<string,T>,id:string):T {
    const record=records.get(id);
    if(!record)fail('23503'); // Never present a broken required join as absent data.
    return record!;
  }
  function named<T extends UnitRecord>(record:T):T & {name:string} {
    return {...record,name:record[`name_${locale}`]};
  }

  const [product]=await read('products','id',[productKey]);
  if(!product)return null;
  const variants=await read('product_variants','product_id',[product.id]);
  const [species,constructions,relationships]=await Promise.all([
    read('wood_species','id',unique(variants.map(row=>row.wood_species_id))),
    read('construction_types','id',unique(variants.map(row=>row.construction_type_id))),
    read('customer_products','product_variant_id',variants.map(row=>row.id)),
  ]);
  const [customers,terms]=await Promise.all([
    read('customers','id',unique(relationships.map(row=>row.customer_id))),
    read('customer_product_terms','customer_product_id',relationships.map(row=>row.id)),
  ]);
  const unitCodes=unique([...variants.map(row=>row.default_quantity_unit_code),...terms.map(row=>row.demand_unit_code)]);
  const units:UnitRecord[]=[];
  if(unitCodes.length){
    const {data,error}=await db.from('units_of_measure').select('code,name_fi,name_pl,name_en').in('code',unitCodes).order('code');
    if(error)fail(error.code);
    units.push(...(data??[]) as UnitRecord[]);
  }
  const speciesById=new Map(species.map(row=>[row.id,row]));
  const constructionById=new Map(constructions.map(row=>[row.id,row]));
  const customersById=new Map(customers.map(row=>[row.id,row]));
  const unitsByCode=new Map(units.map(row=>[row.code,row]));
  const unit=(code:string|null)=>code===null?null:named(reference(unitsByCode,code));
  return {product,locale,as_of:asOf,variants:variants.map(row=>{
    const {thickness_mm,width_mm,length_mm,depth_mm,volume_per_unit_m3,...identity}=row;
    const dimensions={thickness_mm,width_mm,length_mm};
    return {...identity,dimensions,
      wood_species:row.wood_species_id===null?null:named(reference(speciesById,row.wood_species_id)),
      construction_type:row.construction_type_id===null?null:named(reference(constructionById,row.construction_type_id)),
      default_quantity_unit:unit(row.default_quantity_unit_code),
      theoretical_volume_m3:theoreticalVolumePerPiece(dimensions),
      legacy_specification:{depth_mm,volume_per_unit_m3},
      related:{customer_products:relationships.filter(link=>link.product_variant_id===row.id).map(link=>{
        const customer=reference(customersById,link.customer_id);
        const linkedTerms=terms.filter(term=>term.customer_product_id===link.id)
          .sort((a,b)=>a.valid_from.localeCompare(b.valid_from)||a.id.localeCompare(b.id))
          .map(term=>({...term,demand_unit:unit(term.demand_unit_code)}));
        return {...link,customer,terms:linkedTerms,current_terms:linkedTerms.filter(term=>
          product.is_active&&row.is_active&&link.is_active&&customer.is_active&&term.is_active&&
          term.valid_from<=asOf&&(term.valid_to===null||term.valid_to>=asOf))};
      })},
    };
  })};
}

/** Reverse customer view uses the same canonical assembly, including retained history. */
export async function getCustomerProductDefinitions(
  organizationId:string,customerId:string,locale:AppLocale,asOf=new Date().toISOString().slice(0,10),
):Promise<ProductMasterDefinition[]> {
  await requireProductOrganization(organizationId);
  const customerKey=identifier(customerId)!;
  const db=await createClient();
  const variantIds:string[]=[];
  for(let page=0;;page++){
    const {data,error}=await db.from('customer_products').select('id,product_variant_id')
      .eq('organization_id',organizationId).eq('customer_id',customerKey).order('id').range(page*200,page*200+199);
    if(error)throw Object.assign(new Error('Customer products could not be loaded'),{databaseCode:error.code});
    variantIds.push(...(data??[]).map(row=>row.product_variant_id));
    if(!data||data.length<200)break;
  }
  const productIds=new Set<string>();
  for(let batch=0;batch<variantIds.length;batch+=100){
    const {data,error}=await db.from('product_variants').select('id,product_id')
      .eq('organization_id',organizationId).in('id',variantIds.slice(batch,batch+100));
    if(error)throw Object.assign(new Error('Customer variants could not be loaded'),{databaseCode:error.code});
    for(const row of data??[])productIds.add(row.product_id);
  }
  const result:ProductMasterDefinition[]=[];
  for(const productId of productIds){
    const definition=await getProductMasterDefinition(organizationId,productId,locale,asOf);
    if(!definition)throw new Error('Customer product reference is missing');
    result.push({...definition,variants:definition.variants.filter(variant=>variant.related.customer_products.some(link=>link.customer_id===customerKey))
      .map(variant=>({...variant,related:{customer_products:variant.related.customer_products.filter(link=>link.customer_id===customerKey)}}))});
  }
  return result;
}
