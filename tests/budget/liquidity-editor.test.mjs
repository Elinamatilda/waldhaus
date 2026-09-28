import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {loadModule} from '../auth/load-module.mjs';

test('immediate re-edit uses returned versions and Cancel retains saved baseline before refresh completes',async()=>{
 const states=[];let cursor=0;const calls=[];
 const Editor=loadModule('src/components/budget/liquidity-editor.tsx',{
  react:{...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];}},
  'next/navigation':{useRouter:()=>({refresh(){/* Deliberately never completes. */}})},
  '@/components/ui':Object.fromEntries(['Button','Card','Input','MetricCard','Table','TableBody','TableCell','TableHeader','TableRow'].map(name=>[name,name])),
  '@/app/actions/liquidity-forecast':{saveLiquidityForecastAction:async form=>{
   calls.push(form);return {ok:true,saved:{year:2026,months:Array.from({length:12},(_,i)=>({month_number:i+1,edit_version:String(100+i)}))}};
  }},
 }).LiquidityEditor;
 const props={organizationId:'org',year:2026,locale:'en',rows:Array.from({length:12},(_,i)=>({id:String(i),month_number:i+1,edit_version:String(i+1),opening_balance:i===0?10:null,forecasted_sales:null,other_forecasted_income:null,total_outflows:null,minimum_required_balance:null}))};
 const render=()=>{cursor=0;return Editor(props);};
 const nodes=tree=>{if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];};
 const button=(tree,label)=>nodes(tree).find(node=>node.type==='Button'&&node.props.children===label);
 let tree=render();button(tree,'Edit manually').props.onClick();tree=render();
 const opening=nodes(tree).find(node=>node.type==='Input'&&node.props['aria-label']==='January Opening Balance');
 opening.props.onChange({target:{value:'42'}});tree=render();await tree.props.onSubmit({preventDefault(){}});
 tree=render();button(tree,'Edit manually').props.onClick();tree=render();button(tree,'Cancel changes').props.onClick();
 tree=render();button(tree,'Edit manually').props.onClick();tree=render();await tree.props.onSubmit({preventDefault(){}});
 assert.equal(calls[0].get('version_1'),'1');assert.equal(calls[1].get('version_1'),'100');
 assert.equal(calls[1].get('version_12'),'111');assert.equal(calls[1].get('opening_balance_1'),'42');
});
