'use server';
import { revalidatePath } from 'next/cache';
import { getRequestLocale } from '@/lib/i18n/locale';
import { tApp } from '@/lib/i18n/app-ui';
import { tProduct } from '@/lib/i18n/product-master-ui';
import { MASTER_FIELDS, ProductInputError, type MasterEntity } from '@/lib/products/model';
import { archiveProductMaster, saveProductMaster, saveProductWoodSpecies } from '@/lib/products/service';
import type { MutationResult } from '@/lib/sales/validation';

export async function saveProductWoodSpeciesAction(form:FormData):Promise<MutationResult> {
  const locale=await getRequestLocale();
  try {
    // Empty repeated fields represent an explicit empty selection, not a missing form.
    if(form.get('selection_present')!=='true')throw new ProductInputError('Missing selection');
    await saveProductWoodSpecies(String(form.get('organization_id')??''),String(form.get('product_id')??''),
      form.getAll('expected_species_ids'),form.getAll('wood_species_ids'));
    revalidatePath('/sales/products','layout');
    return {ok:true};
  } catch(error) {
    const dbCode=error&&typeof error==='object'&&'databaseCode' in error?String(error.databaseCode):'';
    const code=error&&typeof error==='object'&&'digest' in error||dbCode==='42501'?'FORBIDDEN':
      ['40001','23505','40P01'].includes(dbCode)?'CONFLICT':error instanceof ProductInputError||dbCode.startsWith('22')||dbCode.startsWith('23')?'VALIDATION_ERROR':'DATABASE_ERROR';
    return {ok:false,code,message:['PGRST202','42P01','42883'].includes(dbCode)?tProduct(locale,'speciesUnavailable'):
      code==='CONFLICT'?tProduct(locale,'speciesConflict'):tApp(locale,code==='FORBIDDEN'?'productMaster.forbidden':code==='VALIDATION_ERROR'?'productMaster.invalid':'productMaster.failed')};
  }
}

export async function saveProductMasterAction(form:FormData):Promise<MutationResult> {
  const locale=await getRequestLocale();
  try{
    const entity=String(form.get('entity')) as MasterEntity;
    if(!Object.hasOwn(MASTER_FIELDS,entity))throw new ProductInputError('Unknown entity');
    const org=String(form.get('organization_id')??'');const id=String(form.get('id')??'')||null;const version=String(form.get('edit_version')??'')||null;
    if(form.get('operation')==='archive'){
      if(!id||!version||form.get('confirmed')!=='true')throw new ProductInputError('Archive confirmation required');
      await archiveProductMaster(org,entity,id,version);
    }else{
      const data:Record<string,unknown>={};
      for(const [key,kind] of Object.entries(MASTER_FIELDS[entity])){
        if(!form.has(key))throw new ProductInputError('Missing input');
        const raw=form.get(key);data[key]=kind==='boolean'?(raw==='true'?true:raw==='false'?false:raw):raw===''?null:raw;
      }
      const saved=await saveProductMaster(org,entity,id,version,data);
      revalidatePath('/sales/products','layout');revalidatePath('/sales/customers','layout');revalidatePath('/budget/sales');revalidatePath('/sales/actuals');
      return {ok:true,id:saved.id};
    }
    revalidatePath('/sales/products','layout');revalidatePath('/sales/customers','layout');revalidatePath('/budget/sales');revalidatePath('/sales/actuals');
    return {ok:true};
  }catch(error){
    const dbCode=error&&typeof error==='object'&&'databaseCode' in error?String(error.databaseCode):'';
    const authInterrupt=error&&typeof error==='object'&&'digest' in error;
    const code=authInterrupt||dbCode==='42501'?'FORBIDDEN':['40001','23505','40P01'].includes(dbCode)?'CONFLICT':error instanceof ProductInputError||dbCode.startsWith('22')||dbCode.startsWith('23')?'VALIDATION_ERROR':'DATABASE_ERROR';
    return {ok:false,code,message:tApp(locale,code==='FORBIDDEN'?'productMaster.forbidden':code==='CONFLICT'?'productMaster.conflict':code==='VALIDATION_ERROR'?'productMaster.invalid':'productMaster.failed')};
  }
}
