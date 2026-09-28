export const PRODUCT_UNITS=['PIECE','LINEAR_METER','CUBIC_METER','SQUARE_METER','KILOGRAM'] as const;
export const PRICE_UNITS={PER_PIECE:'PIECE',PER_M3:'CUBIC_METER',PER_LINEAR_METER:'LINEAR_METER',PER_M2:'SQUARE_METER',PER_KG:'KILOGRAM'} as const;
export type ProductUnit=typeof PRODUCT_UNITS[number];
export type PriceBasis=keyof typeof PRICE_UNITS;
export class ProductInputError extends Error {}
export function identifier(value:unknown,nullable=false):string|null {
  if(nullable&&(value===null||value===''))return null;
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new ProductInputError('Invalid identifier');
  return value.toLowerCase();
}
export function decimalInput(value:unknown,scale=6,dimension=false):string|null {
  if(value===null||value==='')return null;
  if(typeof value!=='string'&&typeof value!=='number')throw new ProductInputError('Invalid numeric input');
  const raw=String(value).trim().replace(',','.');
  if(!new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(raw)||raw.length>24)throw new ProductInputError('Invalid numeric input');
  const number=Number(raw);if(!Number.isFinite(number)||number>= (dimension?1e7:1e12)||(dimension&&number<=0))throw new ProductInputError('Numeric input out of range');
  return raw;
}
export function versionInput(value:unknown):string|null {
  if(value===null||value==='')return null;
  if(typeof value!=='string'||!/^\d{1,19}$/.test(value)||BigInt(value)>BigInt('9223372036854775807'))throw new ProductInputError('Invalid version');
  return BigInt(value).toString();
}
export type MasterSaved={id:string;edit_version:string};
export function masterSaved(value:unknown):MasterSaved {
  if(!value||typeof value!=='object'||!('id' in value)||!('edit_version' in value))throw new Error('Invalid save response');
  const id=identifier(value.id);const version=versionInput(value.edit_version);
  if(!id||!version)throw new Error('Invalid save response');return {id,edit_version:version};
}

export const MASTER_FIELDS = {
  "wood_species": {
    "code": "required",
    "name_fi": "required",
    "name_pl": "required",
    "name_en": "required",
    "scientific_name": "text",
    "is_active": "boolean"
  },
  "construction_types": {
    "code": "required",
    "name_fi": "required",
    "name_pl": "required",
    "name_en": "required",
    "is_active": "boolean"
  },
  "product_variants": {
    "product_id": "uuid_required",
    "variant_code": "required",
    "variant_name": "required",
    "wood_species_id": "uuid",
    "construction_type_id": "uuid",
    "quality_code": "text",
    "thickness_mm": "dimension",
    "width_mm": "dimension",
    "length_mm": "dimension",
    "default_quantity_unit_code": "text",
    "is_active": "boolean"
  },
  "customer_products": {
    "customer_id": "uuid_required",
    "product_variant_id": "uuid_required",
    "customer_product_code": "text",
    "customer_product_name": "text",
    "notes": "text",
    "is_active": "boolean"
  },
  "customer_product_terms": {
    "customer_product_id": "uuid_required",
    "valid_from": "date_required",
    "valid_to": "date",
    "demand_quantity": "numeric",
    "demand_unit_code": "text",
    "demand_period": "text",
    "demand_year": "year",
    "unit_price_amount": "numeric",
    "pricing_basis_code": "text",
    "currency_code": "text",
    "delivery_note": "text",
    "notes": "text",
    "is_active": "boolean"
  }
} as const;

export type MasterEntity=keyof typeof MASTER_FIELDS;
export type MasterPayload=Record<string,string|boolean|null>;
export function parseMasterPayload(entity:MasterEntity,value:unknown):MasterPayload {
  const spec=MASTER_FIELDS[entity];
  if(!spec||!value||typeof value!=='object'||Array.isArray(value))throw new ProductInputError('Invalid payload');
  const input=value as Record<string,unknown>;const result:MasterPayload={};
  if(Object.keys(input).some(key=>!(key in spec)))throw new ProductInputError('Unknown input field');
  for(const [key,kind] of Object.entries(spec)){
    if(!Object.hasOwn(input,key))throw new ProductInputError('Missing input field');
    const raw=input[key];
    if(kind==='boolean'){if(typeof raw!=='boolean')throw new ProductInputError('Invalid boolean');result[key]=raw;continue;}
    if(kind.startsWith('uuid')){result[key]=identifier(raw,kind==='uuid');continue;}
    if(kind==='numeric'||kind==='dimension'){result[key]=decimalInput(raw,kind==='dimension'?3:6,kind==='dimension');continue;}
    if(raw===null||raw===''){
      if(kind==='required'||kind==='date_required')throw new ProductInputError('Required input');
      result[key]=null;continue;
    }
    if(typeof raw!=='string'&&!(kind==='year'&&typeof raw==='number'))throw new ProductInputError('Invalid text');
    const text=String(raw).trim();if(text.length>4000||(kind==='required'&&(!text||text.length>200)))throw new ProductInputError('Invalid text');
    if(kind==='year'&&(!/^\d{4}$/.test(text)||Number(text)<2020||Number(text)>2100))throw new ProductInputError('Invalid year');
    if(kind.startsWith('date')&&(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text))throw new ProductInputError('Invalid date');
    result[key]=text;
  }
  if('code' in result&&!/^[a-z][a-z0-9_]{0,79}$/.test(String(result.code)))throw new ProductInputError('Invalid canonical code');
  if(entity==='product_variants'){
    if(!/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(String(result.variant_code)))throw new ProductInputError('Invalid variant code');
    if(result.default_quantity_unit_code!==null&&!PRODUCT_UNITS.includes(result.default_quantity_unit_code as ProductUnit))throw new ProductInputError('Invalid quantity unit');
  }
  if(entity==='customer_product_terms'){
    if(result.valid_to&&String(result.valid_to)<String(result.valid_from))throw new ProductInputError('Invalid validity range');
    const demand=['demand_quantity','demand_unit_code','demand_period','demand_year'];
    if(demand.some(key=>result[key]!==null)&&demand.some(key=>result[key]===null))throw new ProductInputError('Incomplete demand');
    if(result.demand_unit_code!==null&&!PRODUCT_UNITS.includes(result.demand_unit_code as ProductUnit))throw new ProductInputError('Invalid demand unit');
    if(result.demand_period!==null&&!['YEAR','MONTH'].includes(String(result.demand_period)))throw new ProductInputError('Invalid demand period');
    const price=['unit_price_amount','pricing_basis_code','currency_code'];
    if(price.some(key=>result[key]!==null)&&price.some(key=>result[key]===null))throw new ProductInputError('Incomplete price');
    if(result.pricing_basis_code!==null&&!Object.hasOwn(PRICE_UNITS,String(result.pricing_basis_code)))throw new ProductInputError('Invalid price basis');
    if(result.currency_code!==null&&!/^[A-Z]{3}$/.test(String(result.currency_code)))throw new ProductInputError('Invalid currency code');
  }
  return result;
}
