'use client';
import { useState, type ClipboardEvent } from 'react';
import { handleGridPaste, navigateGrid, type PasteFeedback } from '@/lib/grid/paste';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui';
import { saveAnnualBudgetAction } from '@/app/actions/annual-budget';
import { BUDGET_INPUTS, budgetNumber, deriveBudget, emptyBudget, totalBudget, type BudgetValues, type BudgetRow } from '@/lib/budget/model';
import { tApp, type AppMessageKey } from '@/lib/i18n/app-ui';
import type { AppLocale } from '@/lib/i18n/config';

export function AnnualBudgetEditor({organizationId,year,rows,locale}:{organizationId:string;year:number;rows:BudgetRow[];locale:AppLocale}) {
  const router=useRouter();
  const initial=Array.from({length:12},(_,index)=>{
    const row=rows.find(value=>value.month_number===index+1)??emptyBudget();
    return Object.fromEntries(BUDGET_INPUTS.map(field=>[field,row[field]===null?'':String(row[field])])) as Record<typeof BUDGET_INPUTS[number],string>;
  });
  const [draft,setDraft]=useState(initial);
  const [editing,setEditing]=useState(false);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState<AppMessageKey|null>(null);
  const [pasteMessage,setPasteMessage]=useState<PasteFeedback|null>(null);
  const [baseline,setBaseline]=useState(initial);
  const dirty=draft.some((row,i)=>BUDGET_INPUTS.some(field=>row[field]!==baseline[i][field]));
  function paste(event:ClipboardEvent<HTMLInputElement>,startRow:number,startColumn:number) {
    handleGridPaste(event,{fields:BUDGET_INPUTS,draft,startRow,startColumn,enabled:editing&&!pending,locale,months,
      rules:field=>({precision:field==='production_m3'?6:2}),fieldLabel:field=>tApp(locale,`budget.${field}`),apply:setDraft,
      feedback:value=>{setPasteMessage(value);if(!value.error)setMessage(null);}});
  }
  const tag={fi:'fi-FI',pl:'pl-PL',en:'en-GB'}[locale];
  const money=new Intl.NumberFormat(tag,{minimumFractionDigits:2,maximumFractionDigits:2});
  const volume=new Intl.NumberFormat(tag,{maximumFractionDigits:6});
  const months=Array.from({length:12},(_,i)=>new Intl.DateTimeFormat(tag,{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,1))));
  const values=draft.map(row=>{
    try {
      const result=emptyBudget();
      for(const field of BUDGET_INPUTS) result[field]=budgetNumber(row[field],field);
      return result;
    } catch {return null;}
  });
  const total=values.every((row):row is BudgetValues=>row!==null)?totalBudget(values):null;
  function derivedCells(row:BudgetValues|null) {
    const result=row?deriveBudget(row):null;
    return <>
      <TableCell className="text-right">{result?money.format(result.total_cost):'—'}</TableCell>
      <TableCell className="text-right">{row?(row.production_m3===null?'':volume.format(row.production_m3)):'—'}</TableCell>
      <TableCell className="text-right">{result?.cost_per_m3==null?'—':money.format(result.cost_per_m3)}</TableCell>
      <TableCell className="text-right">{result?money.format(result.profit_margin_amount):'—'}</TableCell>
      <TableCell className="text-right">{result?.profit_margin_percent==null?'—':`${money.format(result.profit_margin_percent)} %`}</TableCell>
    </>;
  }
  return <form onSubmit={async(event)=>{
    event.preventDefault();if(pending)return;
    if(values.some(row=>row===null)){setMessage('budget.invalid');return;}
    const form=new FormData();form.set('organization_id',organizationId);form.set('year',String(year));
    draft.forEach((row,index)=>{
      for(const field of BUDGET_INPUTS) form.set(`${field}_${index+1}`,row[field]);
      form.set(`version_${index+1}`,rows.find(value=>value.month_number===index+1)?.edit_version??'');
    });
    setPending(true);setMessage(null);
    try {
      const result=await saveAnnualBudgetAction(form);
      if(result.ok){setBaseline(draft);setPasteMessage(null);setEditing(false);setMessage('budget.saved');router.refresh();}
      else setMessage(({INVALID_INPUT:'budget.invalid',CONFLICT:'budget.conflict',FORBIDDEN:'budget.forbidden',UNAVAILABLE:'budget.unavailable',DATABASE_ERROR:'budget.failed'} as const)[result.code]);
    } catch {setMessage('budget.failed');} finally{setPending(false);}
  }} className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" disabled title={tApp(locale,'budget.importPending')}>{tApp(locale,'budget.import')}</Button>
      {!editing?<Button type="button" onClick={()=>{setEditing(true);setMessage(null);}}>{tApp(locale,'budget.edit')}</Button>:<>
        <Button type="submit" disabled={pending} aria-busy={pending}>{tApp(locale,pending?'budget.saving':'budget.save')}</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={()=>{setDraft(baseline);setEditing(false);setMessage(null);setPasteMessage(null);}}>{tApp(locale,'budget.cancel')}</Button>
      </>}
    </div>
    <p className="text-body-small text-text-secondary">{tApp(locale,'budget.importPending')} {tApp(locale,'budget.eur')}</p>
    {!rows.length&&!editing?<p className="text-body text-text-secondary">{tApp(locale,'budget.empty')}</p>:null}
    {editing?<p className="text-body-small text-text-secondary">{tApp(locale,'gridPaste.hint')}</p>:null}
    {editing&&dirty?<p role="status">{tApp(locale,'gridPaste.dirty')}</p>:null}
    {pasteMessage?<p role={pasteMessage.error?'alert':'status'}>{pasteMessage.text}</p>:null}
    {message?<p role="status">{tApp(locale,message)}</p>:null}
    <Card className="overflow-x-auto p-0">
      <Table>
        <TableHeader><tr>
          <th scope="col" className="px-4 py-3">{tApp(locale,'budget.month')}</th>
          {BUDGET_INPUTS.filter(field=>field!=='production_m3').map(field=><th scope="col" className="px-4 py-3" key={field}>{tApp(locale,`budget.${field}`)}</th>)}
          {(['total_cost','production_m3','cost_per_m3','profit_margin_amount','profit_margin_percent'] as const).map(field=><th scope="col" className="px-4 py-3" key={field}>{tApp(locale,`budget.${field}`)}{field==='production_m3'?' m³':''}{field==='profit_margin_amount'?' EUR':''}</th>)}
        </tr></TableHeader>
        <TableBody>
          {draft.map((row,index)=><TableRow key={index}>
            <TableCell>{months[index]}</TableCell>
            {BUDGET_INPUTS.filter(field=>field!=='production_m3').map(field=><TableCell key={field} className="text-right">
              {editing?<Input aria-label={`${months[index]} ${tApp(locale,`budget.${field}`)}`} inputMode="decimal" disabled={pending} value={row[field]} data-grid-cell={`${index}:${BUDGET_INPUTS.indexOf(field)}`} onPaste={event=>paste(event,index,BUDGET_INPUTS.indexOf(field))} onKeyDown={event=>navigateGrid(event,index,BUDGET_INPUTS.indexOf(field))} onChange={event=>{const value=event.target.value;setDraft(old=>old.map((month,i)=>i===index?{...month,[field]:value}:month));}} />:(values[index]?.[field]==null?'':money.format(values[index]![field]!))}
            </TableCell>)}
            {editing?<>
              <TableCell className="text-right">{values[index]?money.format(deriveBudget(values[index]).total_cost):'—'}</TableCell>
              <TableCell><Input aria-label={`${months[index]} ${tApp(locale,'budget.production_m3')}`} inputMode="decimal" disabled={pending} value={row.production_m3} data-grid-cell={`${index}:${BUDGET_INPUTS.indexOf('production_m3')}`} onPaste={event=>paste(event,index,BUDGET_INPUTS.indexOf('production_m3'))} onKeyDown={event=>navigateGrid(event,index,BUDGET_INPUTS.indexOf('production_m3'))} onChange={event=>{const value=event.target.value;setDraft(old=>old.map((month,i)=>i===index?{...month,production_m3:value}:month));}} /></TableCell>
              <TableCell className="text-right">{values[index]&&deriveBudget(values[index]).cost_per_m3!==null?money.format(deriveBudget(values[index]).cost_per_m3!):'—'}</TableCell>
              <TableCell className="text-right">{values[index]?money.format(deriveBudget(values[index]).profit_margin_amount):'—'}</TableCell>
              <TableCell className="text-right">{values[index]&&deriveBudget(values[index]).profit_margin_percent!==null?`${money.format(deriveBudget(values[index]).profit_margin_percent!)} %`:'—'}</TableCell>
            </>:derivedCells(values[index])}
          </TableRow>)}
          <TableRow><TableCell>{tApp(locale,'budget.total')}</TableCell>
            {BUDGET_INPUTS.filter(field=>field!=='production_m3').map(field=><TableCell key={field} className="text-right">{total?money.format(total[field]):'—'}</TableCell>)}
            {derivedCells(total)}
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  </form>;
}
