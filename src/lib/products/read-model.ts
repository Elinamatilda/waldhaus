import type { AppLocale } from '@/lib/i18n/config';

export type ProductAudit = {
  id:string;organization_id:string;is_active:boolean;archived_at:string|null;
  created_by:string|null;updated_by:string|null;created_at:string;updated_at:string;
};
export type ProductRecord = ProductAudit & {product_code:string|null;name:string;description:string|null};
export type VariantRecord = ProductAudit & {
  product_id:string;variant_code:string|null;variant_name:string|null;edit_version:string;
  wood_species_id:string|null;construction_type_id:string|null;
  quality_code:string|null;quality_label_raw:string|null;
  thickness_mm:string|null;width_mm:string|null;length_mm:string|null;depth_mm:string|null;
  volume_per_unit_m3:string|null;default_quantity_unit_code:string|null;
};
export type ClassificationRecord = ProductAudit & {
  code:string;name_fi:string;name_pl:string;name_en:string;edit_version:string;
};
export type SpeciesRecord = ClassificationRecord & {scientific_name:string|null};
export type UnitRecord = {code:string;name_fi:string;name_pl:string;name_en:string};
export type CustomerRecord = ProductAudit & {customer_code:string|null;name:string;notes:string|null};
export type CustomerProductRecord = ProductAudit & {
  customer_id:string;product_variant_id:string;customer_product_code:string|null;
  customer_product_name:string|null;notes:string|null;edit_version:string;
};
export type CommercialTermRecord = ProductAudit & {
  customer_product_id:string;valid_from:string;valid_to:string|null;edit_version:string;
  demand_quantity:string|null;demand_unit_code:string|null;demand_period:'YEAR'|'MONTH'|null;
  demand_year:number|null;unit_price_amount:string|null;pricing_basis_code:string|null;
  currency_code:string|null;delivery_note:string|null;notes:string|null;
};
export type Named<T> = T & {name:string};
export type CommercialTermDefinition = CommercialTermRecord & {demand_unit:Named<UnitRecord>|null};
export type CustomerProductDefinition = CustomerProductRecord & {
  customer:CustomerRecord;terms:CommercialTermDefinition[];current_terms:CommercialTermDefinition[];
};
export type ProductVariantDefinition = Omit<VariantRecord,'thickness_mm'|'width_mm'|'length_mm'|'depth_mm'|'volume_per_unit_m3'> & {
  dimensions:{thickness_mm:string|null;width_mm:string|null;length_mm:string|null};
  wood_species:Named<SpeciesRecord>|null;construction_type:Named<ClassificationRecord>|null;
  default_quantity_unit:Named<UnitRecord>|null;
  theoretical_volume_m3:string|null;
  legacy_specification:{depth_mm:string|null;volume_per_unit_m3:string|null};
  related:{customer_products:CustomerProductDefinition[]};
};
export type ProductMasterDefinition = {
  product:ProductRecord;variants:ProductVariantDefinition[];locale:AppLocale;as_of:string;
  /** Product-family offering, not a mixed-species variant. Null means migration unavailable. */
  offered_wood_species:Named<SpeciesRecord>[]|null;
};

export type ProductReadRecords = {
  products:ProductRecord;product_variants:VariantRecord;wood_species:SpeciesRecord;
  construction_types:ClassificationRecord;customers:CustomerRecord;
  customer_products:CustomerProductRecord;customer_product_terms:CommercialTermRecord;
};
const audit='id,organization_id,is_active,archived_at,created_by,updated_by,created_at,updated_at';
const versioned=`${audit},edit_version::text`;
// Read projections are separate from mutation whitelists: legacy data remains
// visible without making it writable. Decimal and BIGINT transport is lossless.
export const PRODUCT_READ_COLUMNS:Record<keyof ProductReadRecords,string> = {
  products:`${audit},product_code,name,description`,
  product_variants:`${versioned},product_id,variant_code,variant_name,wood_species_id,construction_type_id,quality_code,quality_label_raw,thickness_mm::text,width_mm::text,length_mm::text,depth_mm::text,volume_per_unit_m3::text,default_quantity_unit_code`,
  wood_species:`${versioned},code,name_fi,name_pl,name_en,scientific_name`,
  construction_types:`${versioned},code,name_fi,name_pl,name_en`,
  customers:`${audit},customer_code,name,notes`,
  customer_products:`${versioned},customer_id,product_variant_id,customer_product_code,customer_product_name,notes`,
  customer_product_terms:`${versioned},customer_product_id,valid_from,valid_to,demand_quantity::text,demand_unit_code,demand_period,demand_year,unit_price_amount::text,pricing_basis_code,currency_code,delivery_note,notes`,
};
