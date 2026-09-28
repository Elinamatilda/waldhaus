import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {loadModule} from '../auth/load-module.mjs';

const engine=loadModule('src/lib/grid/paste.ts');
const annual=loadModule('src/lib/budget/model.ts');
const liquidity=loadModule('src/lib/budget/liquidity-model.ts');
const {tApp}=loadModule('src/lib/i18n/app-ui.ts');
const definitions={
 annual:{file:'annual-editor',component:'AnnualBudgetEditor',action:'annual-budget',save:'saveAnnualBudgetAction',fields:annual.BUDGET_INPUTS,empty:annual.emptyBudget,parse:annual.parseBudgetForm},
 liquidity:{file:'liquidity-editor',component:'LiquidityEditor',action:'liquidity-forecast',save:'saveLiquidityForecastAction',fields:liquidity.LIQUIDITY_INPUTS,empty:liquidity.emptyLiquidity,parse:liquidity.parseLiquidityForm},
};
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function setup(kind,locale='en',saved=false){
 const d=definitions[kind];const states=[];let cursor=0;const calls=[];
 const Editor=loadModule(`src/components/budget/${d.file}.tsx`,{
  react:{...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];}},
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/components/ui':Object.fromEntries(['Button','Card','Input','MetricCard','Table','TableBody','TableCell','TableHeader','TableRow'].map(name=>[name,name])),
  [`@/app/actions/${d.action}`]:{[d.save]:async form=>{calls.push(form);return saved?{ok:true,saved:{year:2026,months:Array.from({length:12},(_,i)=>({month_number:i+1,edit_version:String(100+i)}))}}:{ok:false,code:'DATABASE_ERROR'};}},
 })[d.component];
 const props={organizationId:'org',year:2026,locale,rows:Array.from({length:12},(_,i)=>({...d.empty(),id:String(i),month_number:i+1,edit_version:String(i+1)}))};
 const render=()=>{cursor=0;return Editor(props);};
 const all=()=>nodes(render());
 const button=key=>all().find(n=>n.type==='Button'&&n.props.children===tApp(locale,`budget.${key}`));
 button('edit').props.onClick();
 const cell=(r,c)=>all().find(n=>n.type==='Input'&&n.props['data-grid-cell']===`${r}:${c}`);
 const paste=(r,c,text)=>{let prevented=false;cell(r,c).props.onPaste({clipboardData:{getData:()=>text},preventDefault(){prevented=true;}});return prevented;};
 const status=()=>all().filter(n=>['alert','status'].includes(n.props?.role)).map(n=>n.props.children).join(' ');
 const row=r=>nodes(all().filter(n=>n.type==='TableRow')[r]).filter(n=>n.type==='TableCell').map(n=>n.props.children);
 const save=()=>render().props.onSubmit({preventDefault(){}});
 return {all,button,cell,paste,status,row,save,calls,d};
}

test('shared engine maps only explicit editable keys, clips offsets and never mutates source',()=>{
 const original=[{sales:'1',cost:'2',derived:'unchanged'},{sales:'3',cost:'4',derived:'unchanged'}];
 const options={fields:['sales','cost'],draft:original,startRow:1,startColumn:1,rules:()=>({precision:2})};
 const result=engine.pasteEditableGrid('7\t8\r\n9\t10\r\n',options);
 assert.equal(result.ok,true);assert.equal(result.ignored,3);assert.equal(result.cells.length,1);
 assert.equal(result.draft[1].cost,'7');assert.equal(result.draft[1].derived,'unchanged');assert.equal(original[1].cost,'4');
 const bad=engine.pasteEditableGrid('7\tbad',options);assert.equal(bad.ok,false);assert.equal(bad.sourceColumn,1);
});
test('shared number policy retains blanks/zero, localized grouping, precision and sign restrictions',()=>{
 for(const [text,value] of [['', ''],['0','0'],['110074','110074'],['110 074','110074'],['110074.50','110074.5'],['110074,50','110074.5'],['92\u00a0063,81','92063.81'],['1 234 567,89','1234567.89']])assert.equal(engine.pasteNumber(text,{precision:2}),value);
 assert.equal(engine.pasteNumber('1,123456',{precision:6}),'1.123456');
 assert.equal(engine.pasteNumber('-12,50',{precision:2,allowNegative:true}),'-12.5');
 for(const text of ['1,234.56','12 34','1e3','NaN','-1','0.001','1.230','1000000000000'])assert.throws(()=>engine.pasteNumber(text,{precision:2}));
 assert.throws(()=>engine.pasteNumber('0.1234567',{precision:6}));
});

test('Annual 12×9 paste skips Total Costs, recalculates all derived cells and waits for Save',async()=>{
 const h=setup('annual');const values=['1000','100','50','70','20','30','40','10','2'];
 h.paste(0,0,Array.from({length:12},()=>values.join('\t')).join('\r\n')+'\r\n');
 for(let r=0;r<12;r++)for(let c=0;c<9;c++)assert.equal(h.cell(r,c).props.value,values[c]);
 assert.equal(h.all().filter(n=>n.type==='Input').length,108);
 const row=h.row(0);assert.equal(row[9],'320.00');assert.equal(row[11],'160.00');assert.equal(row[12],'680.00');assert.equal(row[13],'68.00 %');
 assert.match(h.status(),/108 cells pasted/);assert.match(h.status(),/Unsaved changes/);assert.equal(h.calls.length,0);
 h.paste(0,8,'4\n2');assert.equal(h.row(0)[11],'80.00');
 h.paste(0,0,'2000\t200');assert.equal(h.row(0)[9],'420.00');assert.equal(h.row(0)[12],'1,580.00');assert.equal(h.row(0)[13],'79.00 %');
 await h.save();assert.equal(h.calls.length,1);const parsed=h.d.parse(h.calls[0]);
 for(const [c,field] of h.d.fields.entries())assert.equal(parsed.months[11][field],Number(values[c]));
});

test('Liquidity 12×4 paste skips derived columns and independently recalculates each month',async()=>{
 const h=setup('liquidity');const matrix=Array.from({length:12},(_,i)=>[String(i*10),'100','20','30']);
 h.paste(0,0,matrix.map(row=>row.join('\t')).join('\n'));
 for(let r=0;r<12;r++)for(let c=0;c<4;c++)assert.equal(h.cell(r,c).props.value,matrix[r][c]);
 assert.equal(h.all().filter(n=>n.type==='Input').length,48);
 for(let r=0;r<12;r++){
  const row=h.row(r);assert.equal(row[4],'120.00');assert.equal(row[6],'90.00');assert.equal(row[7],`${r*10+90}.00`);assert.equal(row[8],'9.00');assert.equal(row[9],`${Math.max(0,19-r*10)}.00`);
 }
 h.paste(0,0,'-500\t200');assert.equal(h.row(0)[7],'-310.00');assert.equal(h.row(1)[7],'100.00');
 assert.match(h.status(),/Unsaved changes/);assert.equal(h.calls.length,0);
 await h.save();assert.equal(h.calls.length,1);assert.equal(h.d.parse(h.calls[0]).months[1].opening_balance,10);
 assert.equal(h.calls[0].get('minimum_required_balance_2'),null);
 assert.equal(h.d.parse(h.calls[0]).months[1].minimum_required_balance,9);
});

test('Annual production accepts six decimals while monetary precision errors reject the entire paste',async()=>{
 const h=setup('annual');h.paste(0,8,'1,123456\n2');assert.equal(h.cell(0,8).props.value,'1.123456');
 h.paste(0,0,'100\t0.001');assert.equal(h.cell(0,0).props.value,'');assert.equal(h.cell(0,1).props.value,'');
 await h.save();assert.equal(h.d.parse(h.calls[0]).months[0].production_m3,1.123456);
});

for(const kind of ['annual','liquidity']){
 test(`${kind}: offsets and blank/zero survive Save; native paste, Cancel and pending remain safe`,async()=>{
  const h=setup(kind);
  assert.equal(h.paste(2,1,'123'),false);assert.equal(h.cell(2,1).props.value,'');
  h.paste(2,1,'5\t6\n7\t8');h.paste(2,1,'\t0');
  assert.equal(h.cell(2,0).props.value,'');assert.equal(h.cell(2,1).props.value,'');assert.equal(h.cell(2,2).props.value,'0');assert.equal(h.cell(3,1).props.value,'7');
  h.paste(0,0,'\n0');assert.equal(h.cell(0,0).props.value,'');assert.equal(h.cell(1,0).props.value,'0');
  const saving=h.save();h.paste(2,1,'8\t9');assert.equal(h.cell(2,1).props.value,'');await saving;
  const parsed=h.d.parse(h.calls[0]);assert.equal(parsed.months[2][h.d.fields[1]],null);assert.equal(parsed.months[2][h.d.fields[2]],0);
  assert.equal(parsed.months[0][h.d.fields[0]],null);assert.equal(parsed.months[1][h.d.fields[0]],0);
  h.button('cancel').props.onClick();assert.doesNotMatch(h.status(),/Unsaved|pasted/);
  h.button('edit').props.onClick();assert.equal(h.cell(2,2).props.value,'');
 });
 test(`${kind}: bad cell rejects entire block, including invalid overflow; valid overflow clips`,()=>{
  const h=setup(kind);h.paste(2,0,'100\tbad');assert.equal(h.cell(2,0).props.value,'');
  assert.match(h.status(),/March/);assert.equal(h.calls.length,0);
  const last=h.d.fields.length-1;
  h.paste(11,last,'7\tbad');assert.equal(h.cell(11,last).props.value,'');assert.match(h.status(),/Source row 1, column 2/);
  h.paste(11,last,'7\t8\n9\t10');assert.equal(h.cell(11,last).props.value,'7');assert.match(h.status(),/1 cells pasted.*outside/);
 });
 test(`${kind}: Enter uses editable coordinates, Tab and Shift+Tab remain native`,()=>{
  const h=setup(kind);let selector;let focused=false;
  h.cell(2,1).props.onKeyDown({key:'Enter',preventDefault(){},currentTarget:{form:{querySelector(s){selector=s;return {focus(){focused=true;}};}}}});
  assert.equal(selector,'[data-grid-cell="3:1"]');assert.ok(focused);
  for(const shiftKey of [false,true])h.cell(2,1).props.onKeyDown({key:'Tab',shiftKey,preventDefault(){assert.fail('Tab must remain native');}});
 });
 test(`${kind}: successful save clears dirty state and Cancel restores the saved pasted draft`,async()=>{
  const h=setup(kind,'en',true);h.paste(0,0,'5\t6');await h.save();assert.doesNotMatch(h.status(),/Unsaved|pasted/);
  h.button('edit').props.onClick();h.paste(0,0,'8\t9');h.button('cancel').props.onClick();h.button('edit').props.onClick();
  assert.equal(h.cell(0,0).props.value,'5');assert.equal(h.cell(0,1).props.value,'6');
 });
 test(`${kind}: feedback uses shared FI/PL/EN messages and localized month/field`,()=>{
  for(const locale of ['fi','pl','en']){
   const h=setup(kind,locale);h.paste(2,0,'1\tbad');assert.ok(h.status().includes(tApp(locale,'gridPaste.invalid')));
   const month=new Intl.DateTimeFormat({fi:'fi-FI',pl:'pl-PL',en:'en-GB'}[locale],{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,2,1)));
   assert.ok(h.status().includes(`${month} / ${tApp(locale,`${kind==='annual'?'budget':'liquidity'}.${h.d.fields[1]}`)}`));
   h.paste(0,0,'1\t2');assert.ok(h.status().includes(tApp(locale,'gridPaste.success').replace('{count}','2')));
  }
 });
}

test('Liquidity outflow editing and pasting recalculate the read-only 30% target immediately',()=>{
 const h=setup('liquidity');
 h.cell(0,3).props.onChange({target:{value:'1000'}});assert.equal(h.row(0)[8],'300.00');
 h.paste(0,3,'2000\t99999');assert.equal(h.row(0)[8],'600.00');assert.match(h.status(),/outside/);
 assert.equal(h.row(0)[9],'2,600.00');assert.equal(h.cell(0,4),undefined);assert.equal(h.calls.length,0);
 h.paste(0,3,'\n0');assert.equal(h.row(0)[8],'0.00');assert.equal(h.cell(0,3).props.value,'');
});
