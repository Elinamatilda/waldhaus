import {annualForm} from './fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadModule} from '../auth/load-module.mjs';
const {emptyBudget,deriveBudget,totalBudget,budgetYear,budgetNumber,parseBudgetForm}=loadModule('src/lib/budget/model.ts');
test('2025, 2026 and 2027 are independent complete annual submissions',()=>{
 for(const year of [2025,2026,2027]) {
  const input=parseBudgetForm(annualForm(year));assert.equal(input.year,year);assert.equal(input.months.length,12);
  assert.deepEqual(input.months.map(row=>row.month_number),Array.from({length:12},(_,i)=>i+1));
 }
 for(const year of [2019,2101,2026.5,NaN])assert.throws(()=>budgetYear(year));
});
test('cost sum, margin amount and percent, and volume rate',()=>{
 const values={...emptyBudget(),sales_amount:1000,raw_material_cost:100,energy_cost:100,labor_cost:100,maintenance_repairs_cost:100,transportation_logistics_cost:100,administration_sales_cost:100,waste_environmental_cost:100,production_m3:10};
 assert.deepEqual(deriveBudget(values),{total_cost:700,cost_per_m3:70,profit_margin_amount:300,profit_margin_percent:30});
});
test('zero denominators return null, negative margin stays visible',()=>{
 assert.deepEqual(deriveBudget(emptyBudget()),{total_cost:0,cost_per_m3:null,profit_margin_amount:0,profit_margin_percent:null});
 assert.equal(deriveBudget({...emptyBudget(),sales_amount:10,energy_cost:20}).profit_margin_percent,-100);
});
test('year ratios are derived from totals, not monthly averages',()=>{
 const total=totalBudget([{...emptyBudget(),sales_amount:100,energy_cost:50,production_m3:1},{...emptyBudget(),sales_amount:900,energy_cost:900,production_m3:9}]);
 assert.equal(deriveBudget(total).profit_margin_percent,5);assert.equal(deriveBudget(total).cost_per_m3,95);
 assert.equal(totalBudget([{...emptyBudget(),sales_amount:0.1},{...emptyBudget(),sales_amount:0.2}]).sales_amount,0.3);
});
test('malformed, negative and excess precision inputs reject, comma accepted',()=>{
 for(const value of ['oops','-1','NaN','Infinity','1e3','1.001'])assert.throws(()=>budgetNumber(value,'energy_cost'));
 assert.equal(budgetNumber('1,25','energy_cost'),1.25);
 assert.equal(budgetNumber('','energy_cost'),null);
 assert.equal(budgetNumber('0.000001','production_m3'),0.000001);
 assert.throws(()=>budgetNumber(null,'energy_cost'));
});

test('blank and explicit zero remain distinct canonical inputs',()=>{
 const form=annualForm();form.set('sales_amount_1','');form.set('sales_amount_2','0');
 const input=parseBudgetForm(form);
 assert.equal(input.months[0].sales_amount,null);
 assert.equal(input.months[1].sales_amount,0);
 assert.equal(input.months[0].expected_version,null);
 assert.equal(emptyBudget().production_m3,null);
});
test('bigint versions retain all digits and validate the PostgreSQL range',()=>{
 const form=annualForm();form.set('version_1','9007199254740993');
 assert.equal(parseBudgetForm(form).months[0].expected_version,'9007199254740993');
 form.set('version_1','000123');assert.equal(parseBudgetForm(form).months[0].expected_version,'123');
 for(const version of ['1.5','wrong','-1','9223372036854775808']) {
  form.set('version_1',version);assert.throws(()=>parseBudgetForm(form));
 }
});
