import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
const {suggestVariantName: suggest}=loadModule('src/lib/products/variant-naming.ts');
const product={id:'11111111-1111-1111-1111-111111111111',product_code:'KYNNYS',name:'Kynnys'};
const species={code:'oak',name:'Tammi'};
const draft={thickness_mm:'027,500',width_mm:'130.000',length_mm:'3000'};
test('canonical dimensions and catalogue codes generate stable identifiers independently of language and customers',()=>{
 const fi=suggest(product,species,null,draft);
 assert.equal(fi.code,'KYNNYS-OAK-27.5X130X3000');
 assert.equal(fi.name,'Kynnys, Tammi, 27.5 × 130 × 3000 mm');
 assert.equal(fi.valid,true);
 assert.equal(suggest(product,{...species,name:'Dąb'},null,{...draft,customer_id:'PIHLA'}).code,fi.code);
 assert.equal(suggest(product,species,null,{...draft,thickness_mm:'27.5'}).code,fi.code);
});
test('construction and unrestricted quality distinguish suggestions; missing product code uses stable id',()=>{
 const result=suggest(product,species,{code:'finger_jointed',name:'Sormijatkettu'},{...draft,quality_code:'Special'});
 assert.equal(result.code,'KYNNYS-OAK-FINGER_JOINTED-Q-SPECIAL-27.5X130X3000');
 assert.match(result.name,/Sormijatkettu, Special/);
 const fallback=suggest({...product,product_code:null},species,null,draft);
 assert.match(fallback.code,/^P-11111111-1111-1111-1111-111111111111-OAK-/);
 assert.equal(suggest({...product,product_code:null,name:'Different'},species,null,draft).code,fallback.code);
});
test('incomplete or invalid dimensions never produce a saveable suggestion; lengths are not silently truncated',()=>{
 assert.equal(suggest(product,null,null,draft),null);
 for(const thickness_mm of ['', '0', '-1','1e3','27.5555','10000000','invalid']) assert.equal(suggest(product,species,null,{...draft,thickness_mm}),null);
 assert.equal(suggest({...product,product_code:'X'.repeat(80)},species,null,draft).valid,false);
 assert.equal(suggest({...product,name:'X'.repeat(200)},species,null,draft).valid,false);
});
