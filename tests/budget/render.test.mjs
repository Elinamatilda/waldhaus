import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from '../auth/load-module.mjs';
function component(tag){return function MockComponent({children,...props}) {return React.createElement(tag,props,children);};}
test('annual view renders 12 months plus totals, input columns, and no invalid zero ratios in FI/PL/EN',()=>{
 const Editor=loadModule('src/components/budget/annual-editor.tsx',{
  react:React,
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/app/actions/annual-budget':{saveAnnualBudgetAction:async()=>({ok:true})},
  '@/components/ui':{Button:component('button'),Card:component('div'),Input:component('input'),Table:component('table'),TableBody:component('tbody'),TableCell:component('td'),TableHeader:component('thead'),TableRow:component('tr')},
 }).AnnualBudgetEditor;
 for(const locale of ['fi','pl','en']) {
  const html=renderToStaticMarkup(React.createElement(Editor,{organizationId:'org',year:2026,rows:[],locale}));
  assert.equal((html.match(/<tr>/g)??[]).length,14); // header + 12 months + annual total
  assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'));
  assert.match(html, /EUR/);
  const {tApp}=loadModule('src/lib/i18n/app-ui.ts');
  assert.ok(html.includes(tApp(locale,'budget.edit')));
  assert.ok(html.includes(tApp(locale,'budget.total')));
 }
});

test('annual view renders NULL inputs empty and explicit zero visibly',()=>{
 const {emptyBudget}=loadModule('src/lib/budget/model.ts');
 const Editor=loadModule('src/components/budget/annual-editor.tsx',{
  react:React,'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/app/actions/annual-budget':{saveAnnualBudgetAction:async()=>({ok:true})},
  '@/components/ui':{Button:component('button'),Card:component('div'),Input:component('input'),Table:component('table'),TableBody:component('tbody'),TableCell:component('td'),TableHeader:component('thead'),TableRow:component('tr')},
 }).AnnualBudgetEditor;
 const html=renderToStaticMarkup(React.createElement(Editor,{organizationId:'org',year:2026,locale:'en',rows:[{
  ...emptyBudget(),id:'period',month_number:1,edit_version:'9007199254740993',sales_amount:null,raw_material_cost:0,
 }]}));
 const firstRow=html.split('<tbody>')[1].split('</tr>')[0];
 const cells=[...firstRow.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(match=>match[1]);
 assert.equal(cells[1],'');assert.equal(cells[2],'0.00');
});

test('cash flow renders global FI/PL/EN terminology, twelve months and balances in totals',()=>{
 const Editor=loadModule('src/components/budget/cash-flow-editor.tsx',{
  react:React,'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/app/actions/cash-flow-budget':{saveCashFlowBudgetAction:async()=>({ok:true})},
  '@/components/ui':{MetricCard:({label,value})=>React.createElement('div',null,label,value),Button:component('button'),Card:component('div'),Input:component('input'),Table:component('table'),TableBody:component('tbody'),TableCell:component('td'),TableHeader:component('thead'),TableRow:component('tr')},
 }).CashFlowEditor;
 const {tApp}=loadModule('src/lib/i18n/app-ui.ts');
 for(const locale of ['fi','pl','en']){
  const html=renderToStaticMarkup(React.createElement(Editor,{organizationId:'org',year:2026,openingBalance:0,rows:[],locale}));
  assert.equal((html.match(/<tr>/g)??[]).length,14);
  for(const key of ['cashFlow.opening_balance','cashFlow.closing_balance','cashFlow.net_cash_flow','cashFlow.totalsNote'])assert.ok(html.includes(tApp(locale,key)));
  assert.ok(!html.includes('NaN'));assert.ok(!html.includes('Infinity'));
 }
 const {emptyCashFlows}=loadModule('src/lib/budget/cash-flow-model.ts');
 const html=renderToStaticMarkup(React.createElement(Editor,{organizationId:'org',year:2026,openingBalance:-100,locale:'en',rows:[{
  ...emptyCashFlows(),id:'period',month_number:1,opening_balance:-100,edit_version:'1',sales_revenue:null,other_income:0,
 }]}));
 const cells=[...html.split('<tbody>')[1].split('</tr>')[0].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(match=>match[1]);
 assert.equal(cells[1],'-100.00');assert.equal(cells[2],'');assert.equal(cells[3],'0.00');
});

test('liquidity view uses FI/PL/EN, preserves blank/zero and does not sum balances',()=>{
 const Editor=loadModule('src/components/budget/liquidity-editor.tsx',{
  react:React,'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/app/actions/liquidity-forecast':{saveLiquidityForecastAction:async()=>({ok:true})},
  '@/components/ui':{MetricCard:({label,value})=>React.createElement('div',null,label,value),Button:component('button'),Card:component('div'),Input:component('input'),Table:component('table'),TableBody:component('tbody'),TableCell:component('td'),TableHeader:component('thead'),TableRow:component('tr')},
 }).LiquidityEditor;
 const {tApp}=loadModule('src/lib/i18n/app-ui.ts');
 for(const locale of ['fi','pl','en']){
  const html=renderToStaticMarkup(React.createElement(Editor,{organizationId:'org',year:2026,rows:[{id:'1',month_number:1,edit_version:'1',opening_balance:null,forecasted_sales:0,other_forecasted_income:null,total_outflows:null,minimum_required_balance:null}],locale}));
  assert.equal((html.match(/<tr>/g)??[]).length,14);
  assert.ok(html.includes(tApp(locale,'liquidity.salesDefinition')));
  assert.ok(html.includes(tApp(locale,'liquidity.totalsNote')));
  const rows=html.split('<tbody>')[1].split('</tr>');
  const cells=row=>[...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(match=>match[1]);
  assert.equal(cells(rows[0])[1],'');assert.ok(cells(rows[0])[2].includes('0'));
  for(const index of [1,7,8,9])assert.equal(cells(rows[12])[index],'');
 }
});
