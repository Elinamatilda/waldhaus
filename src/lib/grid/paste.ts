import type { ClipboardEvent, KeyboardEvent } from 'react';
import { applyClipboardMatrix, normalizePastedNumber, parseClipboardGrid, validateClipboardMatrix } from './clipboard';
import { tApp } from '@/lib/i18n/app-ui';
import type { AppLocale } from '@/lib/i18n/config';

export type PasteFeedback = {error:boolean;text:string};
export type PasteNumberRules = {precision:number;allowNegative?:boolean};

/** One normalizer and precision policy for all editable spreadsheet fields. */
export function pasteNumber(text:string, rules:PasteNumberRules):string {
  const value=normalizePastedNumber(text);
  const normalized=text.trim().replace(/^€\s*|\s*€$/g,'').trim();
  const decimals=normalized.match(/[.,](\d+)$/)?.[1].length??0;
  if(value!==null&&(Math.abs(value)>=1e12||(!rules.allowNegative&&value<0)||decimals>rules.precision))throw new Error('INVALID_INPUT');
  return value===null?'':String(value);
}

/** Coordinates always refer to editable field keys, never visual/DOM columns. */
export function pasteEditableGrid<F extends string>(text:string, options:{
  fields:readonly F[];draft:Record<F,string>[];startRow:number;startColumn:number;
  rules:(field:F|undefined)=>PasteNumberRules;
}) {
  const result=validateClipboardMatrix(parseClipboardGrid(text),{
    startRow:options.startRow,startColumn:options.startColumn,rows:options.draft.length,columns:options.fields.length,
    parse:(raw,_row,column)=>pasteNumber(raw,options.rules(options.fields[column])),
  });
  if(!result.ok)return result;
  const matrix=applyClipboardMatrix(options.draft.map(row=>options.fields.map(field=>row[field])),result.cells);
  const draft=options.draft.map((row,r)=>({...row,...Object.fromEntries(options.fields.map((field,c)=>[field,matrix[r][c]]))}));
  return {...result,draft};
}

export function handleGridPaste<F extends string>(event:ClipboardEvent<HTMLInputElement>,options:{
  fields:readonly F[];draft:Record<F,string>[];startRow:number;startColumn:number;
  rules:(field:F|undefined)=>PasteNumberRules;enabled:boolean;locale:AppLocale;
  months:readonly string[];fieldLabel:(field:F)=>string;
  apply:(draft:Record<F,string>[])=>void;feedback:(message:PasteFeedback)=>void;
}) {
  const text=event.clipboardData.getData('text/plain');
  if(!/[\t\r\n]/.test(text))return; // Native single-cell paste keeps selection behavior.
  event.preventDefault();
  if(!options.enabled)return;
  const result=pasteEditableGrid(text,options);
  if(!result.ok){
    const field=options.fields[result.column];
    const target=options.months[result.row]&&field
      ? `${options.months[result.row]} / ${options.fieldLabel(field)}`
      : tApp(options.locale,'gridPaste.sourceCell').replace('{row}',String(result.sourceRow+1)).replace('{column}',String(result.sourceColumn+1));
    options.feedback({error:true,text:`${tApp(options.locale,'gridPaste.invalid')}: ${target}`});
    return;
  }
  options.apply(result.draft);
  options.feedback({error:false,text:tApp(options.locale,'gridPaste.success').replace('{count}',String(result.cells.length))+
    (result.ignored?`. ${tApp(options.locale,'gridPaste.overflow')}`:'')});
}

export function navigateGrid(event:KeyboardEvent<HTMLInputElement>,row:number,column:number,attribute='data-grid-cell') {
  if(event.key!=='Enter')return;
  event.preventDefault();
  event.currentTarget.form?.querySelector<HTMLInputElement>(`[${attribute}="${row+1}:${column}"]`)?.focus();
}
