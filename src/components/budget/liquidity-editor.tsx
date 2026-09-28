'use client';
import { useState, type ClipboardEvent } from 'react';
import { handleGridPaste, navigateGrid, type PasteFeedback } from '@/lib/grid/paste';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, MetricCard, Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui';
import { saveLiquidityForecastAction } from '@/app/actions/liquidity-forecast';
import { LIQUIDITY_INPUTS, calculateLiquidity, emptyLiquidity, parseLiquidityDraft, type LiquidityDraft, type LiquidityRow } from '@/lib/budget/liquidity-model';
import { tApp, type AppMessageKey } from '@/lib/i18n/app-ui';
import type { AppLocale } from '@/lib/i18n/config';

const columns=['opening_balance','forecasted_sales','other_forecasted_income','total_inflows','total_outflows','net_cash_flow','closing_balance','minimum_required_balance','sales_needed'] as const;
export function LiquidityEditor({organizationId,year,rows,locale}:{organizationId:string;year:number;rows:LiquidityRow[];locale:AppLocale}) {
  const router=useRouter();
  const initial=Array.from({length:12},(_,index)=>{
    const row=rows.find(row=>row.month_number===index+1)??emptyLiquidity();
    return Object.fromEntries(LIQUIDITY_INPUTS.map(field=>[field,row[field]===null?'':String(row[field])])) as LiquidityDraft;
  });
  const [draft,setDraft]=useState(initial);
  const [versions,setVersions]=useState(()=>Array.from({length:12},(_,i)=>rows.find(row=>row.month_number===i+1)?.edit_version??''));
  const [baseline,setBaseline]=useState(initial);
  const [editing,setEditing]=useState(false);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState<AppMessageKey|null>(null);
  const [pasteMessage,setPasteMessage]=useState<PasteFeedback|null>(null);
  const dirty=draft.some((row,i)=>LIQUIDITY_INPUTS.some(field=>row[field]!==baseline[i][field]));
  function paste(event:ClipboardEvent<HTMLInputElement>,startRow:number,startColumn:number) {
    handleGridPaste(event,{fields:LIQUIDITY_INPUTS,draft,startRow,startColumn,enabled:editing&&!pending,locale,months,
      rules:field=>({precision:2,allowNegative:field==='opening_balance'}),fieldLabel:field=>tApp(locale,`liquidity.${field}`),apply:setDraft,
      feedback:value=>{setPasteMessage(value);if(!value.error)setMessage(null);}});
  }
  const tag={fi:'fi-FI',pl:'pl-PL',en:'en-GB'}[locale];
  const money=new Intl.NumberFormat(tag,{minimumFractionDigits:2,maximumFractionDigits:2});
  const months=Array.from({length:12},(_,i)=>new Intl.DateTimeFormat(tag,{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(year,i,1))));
  let calculated:ReturnType<typeof calculateLiquidity>|null=null;
  try {calculated=calculateLiquidity(parseLiquidityDraft(draft));}catch{/* Invalid drafts block save and derived displays. */}
  const format=(value:number|null|undefined)=>value===null?'':value===undefined?'—':money.format(value);
  return <form className="space-y-4" onSubmit={async event=>{
    event.preventDefault();if(pending)return;
    if(!calculated){setMessage('liquidity.invalid');return;}
    const form=new FormData();form.set('organization_id',organizationId);form.set('year',String(year));
    draft.forEach((row,index)=>{
      for(const field of LIQUIDITY_INPUTS)form.set(`${field}_${index+1}`,row[field]);
      form.set(`version_${index+1}`,versions[index]);
    });
    setPending(true);setMessage(null);
    try {
      const result=await saveLiquidityForecastAction(form);
      if(result.ok){setVersions(result.saved.months.map(row=>row.edit_version));setBaseline(draft);setPasteMessage(null);setEditing(false);setMessage('budget.saved');router.refresh();}
      else setMessage(({INVALID_INPUT:'liquidity.invalid',CONFLICT:'budget.conflict',FORBIDDEN:'budget.forbidden',UNAVAILABLE:'liquidity.unavailable',DATABASE_ERROR:'budget.failed'} as const)[result.code]);
    }catch{setMessage('budget.failed');}finally{setPending(false);}
  }}>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(['forecasted_sales','net_cash_flow','lowest_closing_balance','lowest_balance_month','largest_sales_requirement'] as const).map(field=><MetricCard key={field} label={tApp(locale,`liquidity.${field}`)} value={field==='lowest_balance_month'?(calculated?months[calculated.kpis.lowest_balance_month-1]:'—'):format(calculated?.kpis[field])} />)}
    </section>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" disabled title={tApp(locale,'budget.importPending')}>{tApp(locale,'budget.import')}</Button>
      {!editing?<Button type="button" onClick={()=>{setEditing(true);setMessage(null);}}>{tApp(locale,'budget.edit')}</Button>:<>
        <Button type="submit" disabled={pending} aria-busy={pending}>{tApp(locale,pending?'budget.saving':'budget.save')}</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={()=>{setDraft(baseline);setEditing(false);setMessage(null);setPasteMessage(null);}}>{tApp(locale,'budget.cancel')}</Button>
      </>}
    </div>
    <p className="text-body-small text-text-secondary">{tApp(locale,'liquidity.salesDefinition')} {tApp(locale,'liquidity.distinction')} {tApp(locale,'liquidity.minimumBalanceFormula')} EUR.</p>
    {!rows.length&&!editing?<p className="text-body text-text-secondary">{tApp(locale,'liquidity.empty')}</p>:null}
    {editing?<p className="text-body-small text-text-secondary">{tApp(locale,'gridPaste.hint')}</p>:null}
    {editing&&dirty?<p role="status">{tApp(locale,'gridPaste.dirty')}</p>:null}
    {pasteMessage?<p role={pasteMessage.error?'alert':'status'}>{pasteMessage.text}</p>:null}
    {message?<p role="status">{tApp(locale,message)}</p>:null}
    {editing&&!calculated?<p role="alert">{tApp(locale,'liquidity.invalid')}</p>:null}
    <Card className="overflow-x-auto p-0"><Table>
      <TableHeader><tr><th scope="col" className="px-4 py-3">{tApp(locale,'budget.month')}</th>{columns.map(field=><th key={field} scope="col" className="px-4 py-3">{tApp(locale,`liquidity.${field}`)}</th>)}</tr></TableHeader>
      <TableBody>{draft.map((row,index)=><TableRow key={index}>
        <TableCell>{months[index]}</TableCell>
        {columns.map(field=><TableCell key={field} className="text-right">
          {editing&&LIQUIDITY_INPUTS.some(input=>input===field)?<Input aria-label={`${months[index]} ${tApp(locale,`liquidity.${field}`)}`} inputMode="decimal" disabled={pending} value={row[field as keyof LiquidityDraft]} data-grid-cell={`${index}:${LIQUIDITY_INPUTS.indexOf(field as keyof LiquidityDraft)}`} onPaste={event=>paste(event,index,LIQUIDITY_INPUTS.indexOf(field as keyof LiquidityDraft))} onKeyDown={event=>navigateGrid(event,index,LIQUIDITY_INPUTS.indexOf(field as keyof LiquidityDraft))} onChange={event=>{const value=event.target.value;setDraft(old=>old.map((month,i)=>i===index?{...month,[field]:value}:month));}} />:format(calculated?.rows[index][field])}
        </TableCell>)}
      </TableRow>)}
        <TableRow><TableCell>{tApp(locale,'budget.total')}</TableCell>{columns.map(field=><TableCell key={field} className="text-right">{format(calculated?.totals[field])}</TableCell>)}</TableRow>
      </TableBody>
    </Table></Card>
    <p className="text-body-small text-text-secondary">{tApp(locale,'liquidity.totalsNote')}</p>
  </form>;
}
