import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {loadModule} from '../auth/load-module.mjs';
const clipboard=loadModule('src/lib/grid/clipboard.ts');

test('TSV preserves blanks, zero, CRLF and exactly one terminal newline',()=>{
 assert.equal(JSON.stringify(clipboard.parseClipboardGrid('1\t\t0\r\n2\t3\t\r\n')),JSON.stringify([['1','','0'],['2','3','']]));
 assert.equal(clipboard.parseClipboardGrid('1\n\n').length,2);
});
test('normalization accepts decimal comma/dot, grouped spaces and euro formatting; rejects ambiguity',()=>{
 for(const [input,expected] of [['',null],['0',0],['110074',110074],['110 074',110074],['92\u00a0063,81',92063.81],['1\u202f234\u202f567,89',1234567.89],[' € 110074.50 ',110074.5],['110,50 €',110.5]])assert.equal(clipboard.normalizePastedNumber(input),expected);
 for(const input of ['12abc','1.2.3','110,074.50','12 34','€','1e3'])assert.throws(()=>clipboard.normalizePastedNumber(input));
});
test('overflow is validated before any writes; source matrix is immutable',()=>{
 const options={startRow:0,startColumn:0,rows:1,columns:1,parse:clipboard.normalizePastedNumber};
 assert.equal(clipboard.validateClipboardMatrix([['2','bad']],options).ok,false);
 const result=clipboard.validateClipboardMatrix([['2','3']],options);
 assert.equal(result.ignored,1);
 const original=[[1]];
 assert.equal(clipboard.applyClipboardMatrix(original,result.cells)[0][0],2);
 assert.equal(original[0][0],1);
});

function setup(locale='en'){
 const states=[];let cursor=0;const calls=[];
 const Editor=loadModule('src/components/budget/cash-flow-editor.tsx',{
  react:{...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];}},
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/components/ui':Object.fromEntries(['Button','Card','Input','MetricCard','Table','TableBody','TableCell','TableHeader','TableRow'].map(name=>[name,name])),
  '@/app/actions/cash-flow-budget':{saveCashFlowBudgetAction:async form=>{calls.push(form);return {ok:false,code:'DATABASE_ERROR'};}},
 }).CashFlowEditor;
 const props={organizationId:'org',year:2026,openingBalance:10,locale,rows:Array.from({length:12},(_,i)=>({id:String(i),month_number:i+1,edit_version:String(i+1),opening_balance:i===0?10:null,sales_revenue:null,other_income:null,operating_costs:null,investments:null,loan_payments:null}))};
 const render=()=>{cursor=0;return Editor(props);};
 const nodes=tree=>{if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];};
 let tree=render();nodes(tree).find(n=>n.type==='Button'&&n.props.children===({en:'Edit manually',fi:'Muokkaa käsin',pl:'Edytuj ręcznie'}[locale]))?.props.onClick();
 const all=()=>nodes(render());
 const cell=(row,column)=>all().find(n=>n.type==='Input'&&n.props['data-cash-cell']===`${row}:${column}`);
 const paste=(input,text)=>{let prevented=false;input.props.onPaste({clipboardData:{getData:()=>text},preventDefault(){prevented=true;}});return prevented;};
 const status=()=>all().filter(n=>['alert','status'].includes(n.props?.role)).map(n=>n.props.children).join(' ');
 return {all,cell,paste,status,calls,render};
}
test('12×5 paste maps fields, recalculates chain, marks dirty, cancels, and persists only on Save',async()=>{
 const h=setup();const text=Array.from({length:12},()=>['110','10','50','5','2'].join('\t')).join('\r\n')+'\r\n';
 assert.equal(h.paste(h.cell(0,0),text),true);
 for(let r=0;r<12;r++)for(let c=0;c<5;c++)assert.equal(h.cell(r,c).props.value,['110','10','50','5','2'][c]);
 assert.match(h.status(),/60 cells pasted/);assert.match(h.status(),/Unsaved changes/);
 assert.equal(h.all().find(n=>n.type==='MetricCard'&&n.props.label==='Ending Cash').props.value,'766.00');
 assert.equal(h.calls.length,0);
 await h.render().props.onSubmit({preventDefault(){}});
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].get('sales_revenue_12'),'110');
 h.all().find(n=>n.type==='Button'&&n.props.children==='Cancel changes').props.onClick();
 assert.doesNotMatch(h.status(),/Unsaved|pasted/);
});
test('offset mapping preserves opening and unrelated cells; blanks differ from zero in submitted form',async()=>{
 const h=setup();h.paste(h.cell(2,1),'0\t92 063,81\t\n1\t2\t3');
 assert.equal(h.cell(2,0).props.value,'');assert.equal(h.cell(2,1).props.value,'0');assert.equal(h.cell(2,2).props.value,'92063.81');assert.equal(h.cell(2,3).props.value,'');assert.equal(h.cell(3,1).props.value,'1');
 await h.render().props.onSubmit({preventDefault(){}});
 assert.equal(h.calls[0].get('opening_balance'),'10');assert.equal(h.calls[0].get('other_income_3'),'0');assert.equal(h.calls[0].get('investments_3'),'');
});
test('invalid block including overflow is atomic and names the offending cell',()=>{
 const h=setup();h.paste(h.cell(2,1),'100\tbad');
 assert.equal(h.cell(2,1).props.value,'');assert.match(h.status(),/March \/ Operating Costs/);
 for(const text of ['1\t110,074.50','1\t-1','1\t0.001','1\t1000000000000']){h.paste(h.cell(11,4),text);assert.equal(h.cell(11,4).props.value,'');assert.match(h.status(),/Source row 1, column 2/);}
 assert.equal(h.calls.length,0);
});
test('bounds, read-only opening, single-value native paste and pending protection',async()=>{
 const h=setup();h.paste(h.cell(11,4),'7\t8\n9\t10');assert.equal(h.cell(11,4).props.value,'7');assert.match(h.status(),/1 cells pasted.*outside/);
 assert.equal(h.all().find(n=>n.type==='Input'&&n.props['aria-label']==='January Opening Balance'),undefined);
 assert.equal(h.paste(h.cell(0,0),'123'),false);assert.equal(h.cell(0,0).props.value,'');
 const saving=h.render().props.onSubmit({preventDefault(){}});
 h.paste(h.cell(0,0),'2\t3');assert.equal(h.cell(0,0).props.value,'');await saving;
});
test('Enter focuses same column in next month without submitting',()=>{
 const h=setup();let selector;let focused=false;let prevented=false;
 h.cell(2,3).props.onKeyDown({key:'Enter',preventDefault(){prevented=true;},currentTarget:{form:{querySelector(s){selector=s;return {focus(){focused=true;}};}}}});
 assert.equal(selector,'[data-cash-cell="3:3"]');assert.ok(focused&&prevented);
});

test('clearing a previously populated cell preserves null rather than zero',async()=>{
 const h=setup();h.paste(h.cell(0,0),'5\t6');h.paste(h.cell(0,0),'\t0');
 assert.equal(h.cell(0,0).props.value,'');assert.equal(h.cell(0,1).props.value,'0');
 await h.render().props.onSubmit({preventDefault(){}});
 const {parseCashFlowForm}=loadModule('src/lib/budget/cash-flow-model.ts');
 const parsed=parseCashFlowForm(h.calls[0]);assert.equal(parsed.months[0].sales_revenue,null);assert.equal(parsed.months[0].other_income,0);
});
test('paste messages are translated in FI, PL and EN',()=>{
 const {tApp}=loadModule('src/lib/i18n/app-ui.ts');
 for(const locale of ['fi','pl','en'])for(const key of ['paste','data','invalid','overflow','success','dirty','hint','sourceCell'])assert.ok(tApp(locale,`gridPaste.${key}`));
 assert.equal(tApp('fi','gridPaste.invalid'),'Virhe liitetyssä datassa');
 assert.equal(tApp('pl','gridPaste.overflow'),'Część komórek znalazła się poza tabelą');
});
