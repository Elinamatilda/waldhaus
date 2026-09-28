import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {loadModule} from '../auth/load-module.mjs';
test('global catalogue has Budget terminology in every locale',()=>{
 const {tApp}=loadModule('src/lib/i18n/app-ui.ts');
 for(const locale of ['fi','pl','en'])for(const key of ['nav.budget','nav.budgetOverview','nav.annualBudget','nav.salesBudgetForecast','budget.raw_material_cost','budget.invalid','budget.saved'])assert.ok(tApp(locale,key));
 assert.equal(tApp('fi','nav.annualBudget'),'Vuosibudjetti');
 assert.equal(tApp('pl','nav.salesBudgetForecast'),'Budżet sprzedaży i prognoza');
});
test('Budget navigation has five routes, Sales no longer contains planning',()=>{
 const {navGroups}=loadModule('src/components/navigation/nav-config.ts');
 assert.deepEqual(navGroups.find(group=>group.titleKey==='nav.budget').items.map(item=>item.href),['/budget','/budget/annual','/budget/cash-flow','/budget/liquidity','/budget/sales']);
 assert.ok(!navGroups.find(group=>group.titleKey==='sales.group').items.some(item=>item.href==='/sales/planning'));
});
test('legacy planning redirects with selection filters to the single moved implementation',async()=>{
 const page=loadModule('src/app/(authenticated)/sales/planning/page.tsx',{'next/navigation':{redirect:path=>{throw Error(path);}}}).default;
 await assert.rejects(page({searchParams:Promise.resolve({year:'2026',customer:'abc',org:'untrusted'})}),error=>error.message==='/budget/sales?year=2026&customer=abc');
 assert.ok(readFileSync('src/app/(authenticated)/budget/sales/page.tsx','utf8').includes('MonthlyFactsGrid'));
 assert.ok(!readFileSync('src/app/(authenticated)/sales/planning/page.tsx','utf8').includes('MonthlyFactsGrid'));
});
