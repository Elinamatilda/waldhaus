import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from '../auth/load-module.mjs';
const component=tag=>function Mock({children,...props}){return React.createElement(tag,props,children);};
const ui={Button:component('button'),Card:component('div'),Dialog:()=>null,EmptyState:({title,description})=>React.createElement('p',null,title,description),FormField:component('label'),Input:component('input'),Select:component('select'),Textarea:component('textarea'),Checkbox:component('input'),MultiCheckboxSelect:({name,value})=>React.createElement(React.Fragment,null,...value.map(id=>React.createElement('input',{key:id,type:'hidden',name,value:id}))),StatusBadge:({children})=>React.createElement('span',null,children),SectionHeader:({title,actions})=>React.createElement('header',null,React.createElement('h2',null,title),actions),Table:component('table'),TableHeader:component('thead'),TableBody:component('tbody'),TableRow:component('tr'),TableCell:component('td')};
const Manager=loadModule('src/components/sales/product-master-manager.tsx',{
 react:React,'next/navigation':{useRouter:()=>({refresh(){}})},'next/link':component('a'),
 './product-species-selector':{ProductSpeciesSelector:()=>null},
 './mutation-form':{SalesMutationForm:component('form')},
 '@/app/actions/product-master':{saveProductMasterAction:async()=>({ok:true})},
 '@/components/ui':ui,
}).ProductMasterManager;
const variant={id:'v',product_id:'p',variant_code:'P-2450',variant_name:'Moulding',dimensions:{thickness_mm:'32.000',width_mm:'46.000',length_mm:'2450.000'},is_active:true,edit_version:'9007199254740993',wood_species:{name:'Tammi'},construction_type:{name:'Massiivipuu'},default_quantity_unit:{name:'kpl'},theoretical_volume_m3:'0.0036064',related:{customer_products:[]}};
const definition={product:{id:'p',name:'Mouldings',is_active:true},variants:[variant],as_of:'2026-09-28'};
const lookups={wood_species:[],construction_types:[]};
const render=(locale,props={})=>renderToStaticMarkup(React.createElement(Manager,{organizationId:'o',locale,definition,lookups,customers:[],...props}));
const {tProduct}=loadModule('src/lib/i18n/product-master-ui.ts');

test('product overview exposes add variant, canonical millimetres and nested detail navigation in FI/PL/EN',()=>{
 for(const locale of ['fi','pl','en']){
  const html=render(locale);
  assert.ok(html.includes(tProduct(locale,'addVariant')));
  assert.ok(html.includes('href="/sales/products/p/variants/v"'));
  assert.ok(html.includes('32 × 46 × 2450 mm'));
  assert.ok(html.includes(tProduct(locale,'lookups')));
 }
});
test('variant detail displays the canonical calculated value unchanged and separates customers from physical specification',()=>{
 for(const locale of ['fi','pl','en']){
  const html=render(locale,{variantId:'v'});
  assert.ok(html.includes('0.0036064'));
  assert.ok(html.includes(tProduct(locale,'geometry')));
  assert.ok(html.includes(tProduct(locale,'addCustomer')));
  assert.ok(html.includes(tProduct(locale,'notOrders')));
  assert.ok(!html.includes(tProduct(locale,'addVariant')));
 }
});
test('current and historical terms remain separate and zero price is preserved',()=>{
 const current={id:'t',is_active:true,edit_version:'5',valid_from:'2026-01-01',valid_to:null,demand_quantity:'1500.000000',demand_unit:{name:'kpl'},demand_period:'YEAR',demand_year:2026,unit_price_amount:'0.000000',pricing_basis_code:'PER_PIECE',currency_code:'EUR'};
 const future={...current,id:'f',valid_from:'2027-01-01',demand_year:2027,unit_price_amount:'10.440000'};
 const link={id:'l',customer:{id:'c',name:'Customer Oy',is_active:true},is_active:true,edit_version:'3',customer_product_code:'CUSTOMER-REF',customer_product_name:'Customer name',current_terms:[current],terms:[current,future]};
 const html=render('fi',{variantId:'v',definition:{...definition,variants:[{...variant,related:{customer_products:[link]}}]}});
 const beforeHistory=html.split('<details>')[0];
 assert.ok(beforeHistory.includes('1500 kpl / Vuosi (2026)'));
 assert.ok(beforeHistory.includes('0 EUR / kpl'));
 assert.ok(!beforeHistory.includes('2027-01-01'));
 assert.ok(html.includes('10.44 EUR / kpl'));
 assert.ok(html.includes('CUSTOMER-REF'));
});
test('empty product remains actionable, archived product cannot add active variants',()=>{
 const empty=render('en',{definition:{...definition,variants:[]}});
 assert.ok(empty.includes('Add variant'));assert.ok(empty.includes(tProduct('en','emptyVariants')));
 const archived=render('en',{definition:{...definition,product:{...definition.product,is_active:false}}});
 assert.match(archived,/<button disabled="">Add variant/);
});

test('nested editors bind parent ids, preserve version tokens and exclude legacy physical fields',()=>{
 function editorHtml(editor, draft = {}, editorLookups = lookups, editorDefinition = definition){
  const Editor=loadModule('src/components/sales/product-master-manager.tsx',{
   react:{...React,useTransition:()=>[false,()=>{}],useState:initial=>[initial===null?editor:!Array.isArray(initial) && typeof initial === 'object'?draft:initial,()=>{}]},
   'next/navigation':{useRouter:()=>({refresh(){}})},'next/link':component('a'),
   './product-species-selector':{ProductSpeciesSelector:()=>null},
 './mutation-form':{SalesMutationForm:({children})=>React.createElement('form',null,children)},
   '@/app/actions/product-master':{saveProductMasterAction:async()=>({ok:true})},
   '@/components/ui':{...ui,Dialog:({open,children})=>open?React.createElement('section',null,children):null,FormField:({children})=>React.createElement('div',null,children)},
  }).ProductMasterManager;
  return renderToStaticMarkup(React.createElement(Editor,{organizationId:'o',locale:'en',definition:editorDefinition,lookups:editorLookups,customers:[{id:'c',name:'Customer',is_active:true}],variantId:'v'}));
 }
 const physical=editorHtml({entity:'product_variants',row:null});
 assert.match(physical, /id="generated-variant-code"[^>]*readOnly/);
 assert.match(physical, /type="submit" disabled/);
 const existing=editorHtml({entity:'product_variants',row:variant},{thickness_mm:'99'});
 assert.ok(existing.includes('value="P-2450"'));
 assert.ok(existing.includes('value="Moulding"'));
 assert.ok(!existing.includes('generated-variant-code'));
 assert.ok(physical.includes('name="product_id" value="p"'));
 for(const field of ['wood_species_id','construction_type_id','thickness_mm','width_mm','length_mm','default_quantity_unit_code'])assert.ok(physical.includes(`name="${field}"`));
 for(const field of ['customer_id','depth_mm','volume_per_unit_m3','unit_price_amount'])assert.ok(!physical.includes(`name="${field}"`));
 const completeDraft={wood_species_id:'oak-id',construction_type_id:'solid-id',thickness_mm:'27',width_mm:'130',length_mm:'3000'};
 const catalog={wood_species:[{id:'oak-id',code:'oak',name_en:'Oak',is_active:true}],construction_types:[{id:'solid-id',code:'solid',name_en:'Solid',is_active:true}]};
 const productDefinition={...definition,product:{...definition.product,product_code:'THRESHOLD'}};
 const complete=editorHtml({entity:'product_variants',row:null},completeDraft,catalog,productDefinition);
 assert.match(complete.match(/<input[^>]*id="generated-variant-code"[^>]*>/)?.[0] ?? "", /value="THRESHOLD-OAK-SOLID-27X130X3000"/);
 assert.ok(complete.includes('Mouldings, Oak, Solid, 27 × 130 × 3000 mm'));
 assert.ok(!complete.includes('type="submit" disabled'));
 const duplicate=editorHtml({entity:'product_variants',row:null},completeDraft,catalog,{...productDefinition,variants:[{...variant,is_active:false,variant_code:'THRESHOLD-OAK-SOLID-27X130X3000'}]});
 assert.ok(duplicate.includes(tProduct('en','variantCodeExists')));
 assert.ok(duplicate.includes('type="submit" disabled'));
 const customer=editorHtml({entity:'customer_products',row:null,parentId:'v'});
 assert.ok(customer.includes('name="product_variant_id" value="v"'));
 assert.ok(customer.includes('name="customer_id"'));
 const terms=editorHtml({entity:'customer_product_terms',row:null,parentId:'link'});
 assert.ok(terms.includes('name="customer_product_id" value="link"'));
 assert.ok(terms.includes('name="demand_quantity"'));
 const archive=editorHtml({entity:'product_variants',row:variant,archive:true});
 assert.ok(archive.includes('name="edit_version" value="9007199254740993"'));
 assert.ok(archive.includes('name="confirmed" value="true"'));
});
