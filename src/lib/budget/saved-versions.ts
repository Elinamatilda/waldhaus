export type BudgetSaved = {year:number;months:{month_number:number;edit_version:string}[]};
export function budgetSaved(value:unknown,year:number):BudgetSaved {
  if(!value||typeof value!=='object'||!('year' in value)||value.year!==year||!('months' in value)||!Array.isArray(value.months)||value.months.length!==12)throw new Error('INVALID_SAVE_RESPONSE');
  const months=value.months.map((row,index)=>{
    if(!row||typeof row!=='object'||row.month_number!==index+1||typeof row.edit_version!=='string'||!/^\d{1,19}$/.test(row.edit_version)||BigInt(row.edit_version)>BigInt('9223372036854775807'))throw new Error('INVALID_SAVE_RESPONSE');
    return {month_number:row.month_number as number,edit_version:row.edit_version as string};
  });
  return {year,months};
}
