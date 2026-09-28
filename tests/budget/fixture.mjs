import {loadModule} from '../auth/load-module.mjs';
const {BUDGET_INPUTS}=loadModule('src/lib/budget/model.ts');
export function annualForm(year=2026) {
 const form=new FormData();form.set('year',String(year));form.set('organization_id','org-a');
 for(let month=1;month<=12;month++) {
  form.set(`version_${month}`,'');
  for(const field of BUDGET_INPUTS) form.set(`${field}_${month}`,field==='sales_amount'?'100':'0');
 }
 return form;
}
