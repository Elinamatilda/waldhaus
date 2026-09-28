import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
const model=loadModule('src/lib/products/model.ts');
const calc=loadModule('src/lib/products/calculations.ts');
const dims=(t,w,l)=>({thickness_mm:String(t),width_mm:String(w),length_mm:String(l)});
test('exact theoretical volume and basis-aware revenue for all supplied products',()=>{
 const cases=[
  [40,650,4000,'300','2225','PER_M3','0.104','31.2','69420'],
  [27,130,3000,'1500','10.44','PER_PIECE','0.01053','15.795','15660'],
  [27,170,3000,'2500','15.39','PER_PIECE','0.01377','34.425','38475'],
  [27,210,3000,'1000','20.07','PER_PIECE','0.01701','17.01','20070'],
  [32,46,2450,'3000','2600','PER_M3','0.0036064','10.8192','28129.92'],
  [32,46,3050,'3000','2600','PER_M3','0.0044896','13.4688','35018.88'],
  [27,100,650,'1275','1795','PER_M3','0.001755','2.237625','4016.536875'],
  [27,100,750,'5100','1795','PER_M3','0.002025','10.3275','18537.8625'],
  [27,100,850,'10200','1795','PER_M3','0.002295','23.409','42019.155'],
  [27,100,950,'10200','1795','PER_M3','0.002565','26.163','46962.585'],
 ];
 for(const [t,w,l,q,price,basis,volume,annual,revenue] of cases){
  assert.equal(calc.theoreticalVolumePerPiece(dims(t,w,l)),volume);
  assert.equal(calc.demandVolumeM3(dims(t,w,l),q,'PIECE'),annual);
  assert.equal(calc.expectedRevenue(dims(t,w,l),q,'PIECE',price,basis),revenue);
 }
 assert.equal(calc.demandVolumeM3(dims(40,650,4000),'25','PIECE'),'2.6');
});
test('missing dimensions, incompatible units and NULL never invent geometry or prices',()=>{
 const missing={...dims(27,130,3000),length_mm:null};
 assert.equal(calc.theoreticalVolumePerPiece(missing),null);
 assert.equal(calc.demandVolumeM3(missing,'10','PIECE'),null);
 assert.equal(calc.demandVolumeM3(missing,'10','CUBIC_METER'),'10');
 assert.equal(calc.demandVolumeM3(dims(27,130,3000),'10','KILOGRAM'),null);
 assert.equal(calc.expectedRevenue(missing,'10','KILOGRAM','5','PER_M3'),null);
 assert.equal(calc.expectedRevenue(missing,'10','KILOGRAM','5','PER_KG'),'50');
 assert.equal(calc.expectedRevenue(missing,'0','PIECE','5','PER_PIECE'),'0');
 assert.equal(calc.expectedRevenue(missing,null,'PIECE','5','PER_PIECE'),null);
});
test('fractional millimetres retain exact precision and no float truncation',()=>{
 assert.equal(calc.theoreticalVolumePerPiece(dims('0.001','0.001','0.001')),'0.000000000000000001');
 assert.throws(()=>calc.theoreticalVolumePerPiece(dims('-1',100,100)));
 assert.throws(()=>calc.theoreticalVolumePerPiece(dims('1.0001',100,100)));
});
const payload=entity=>Object.fromEntries(Object.entries(model.MASTER_FIELDS[entity]).map(([key,kind])=>[key,kind==='boolean'?true:null]));
const id='11111111-1111-4111-8111-111111111111';
test('commercial quantity has an explicit single period/unit/year and price has basis/currency',()=>{
 const term={...payload('customer_product_terms'),customer_product_id:id,valid_from:'2026-01-01',demand_quantity:'300',demand_unit_code:'PIECE',demand_period:'YEAR',demand_year:'2026',unit_price_amount:'2225',pricing_basis_code:'PER_M3',currency_code:'EUR'};
 assert.equal(model.parseMasterPayload('customer_product_terms',term).demand_quantity,'300');
 for(const key of ['demand_unit_code','demand_year','pricing_basis_code','currency_code'])assert.throws(()=>model.parseMasterPayload('customer_product_terms',{...term,[key]:null}));
 assert.throws(()=>model.parseMasterPayload('customer_product_terms',{...term,valid_to:'2025-12-31'}));
 assert.throws(()=>model.parseMasterPayload('customer_product_terms',{...term,valid_from:'2026-02-30'}));
 assert.throws(()=>model.parseMasterPayload('customer_product_terms',{...term,annual_volume:'65'}));
});
test('physical payload excludes customer, demand, price and stored derived volume',()=>{
 const variant={...payload('product_variants'),product_id:id,variant_code:'THRESHOLD-130',variant_name:'Threshold 130'};
 assert.equal(model.parseMasterPayload('product_variants',variant).wood_species_id,null);
 for(const key of ['customer_id','volume_per_unit_m3','sales_price','annual_quantity'])assert.throws(()=>model.parseMasterPayload('product_variants',{...variant,[key]:'1'}));
 assert.throws(()=>model.parseMasterPayload('product_variants',{...variant,thickness_mm:'bad'}));
});
test('canonical species codes reject translated/case variants and bigint versions keep all digits',()=>{
 const species={...payload('wood_species'),code:'oak',name_fi:'Tammi',name_pl:'Dąb',name_en:'Oak'};
 assert.equal(model.parseMasterPayload('wood_species',species).code,'oak');
 assert.throws(()=>model.parseMasterPayload('wood_species',{...species,code:'Oak'}));
 assert.equal(model.versionInput('9007199254740993'),'9007199254740993');
 assert.throws(()=>model.versionInput('9223372036854775808'));
});
