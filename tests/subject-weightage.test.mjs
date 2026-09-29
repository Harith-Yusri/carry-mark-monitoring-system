import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source = (await readFile(new URL('../src/features/lecturer/AssessmentsTab.tsx', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '').replace('export function AssessmentsTab', 'function AssessmentsTab');
const { code } = await transform(source, { loader: 'tsx', jsx: 'transform' });
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]; }
function setup(max) {
  const states = [max, max === null ? '' : String(max), false, false]; let cursor = 0; const saves = [];
  const useState = initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => states[i] = typeof value === 'function' ? value(states[i]) : value]; };
  const icon = () => null;
  const Component = new Function('React','useState','useEffect','useMemo','useColors','CheckCircle','Edit3','Plus','Trash2','X','saveOfferingWeightage',code+';return AssessmentsTab;')(React,useState,()=>{},fn=>fn(),()=>({}),icon,icon,icon,icon,icon,async(...args)=>saves.push(args));
  const render=()=>{ cursor=0; return Component({offeringId:'offering',subjectCode:'ITT593'}); };
  return {render,saves};
}
test('new subjects require a saved weightage before adding assessments',()=>{
 const ui=setup(null); const tree=ui.render();
 assert.match(renderToStaticMarkup(tree), /Not set/);
 const button=nodes(tree).find(n=>n.type==='button' && React.Children.toArray(n.props.children).includes(' Add Assessment'));
 assert.equal(button.props.disabled,true);
});
test('lecturer can save 60 percent and the allocation display uses it',async()=>{
 const ui=setup(null);
 nodes(ui.render()).find(n=>n.props?.id==='subject-carry-max').props.onChange({target:{value:'60'}});
 await nodes(ui.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.deepEqual(ui.saves,[['offering',60]]);
 const html=renderToStaticMarkup(ui.render());
 assert.match(html,/60%/); assert.doesNotMatch(html,/50%/);
});
test('assessment dialog uses the saved maximum for remaining weightage',()=>{
 const ui=setup(70);
 nodes(ui.render()).find(n=>n.type==='button' && React.Children.toArray(n.props.children).includes(' Add Assessment')).props.onClick();
 const html=renderToStaticMarkup(ui.render());
 assert.match(html,/max="70"/); assert.match(html,/70%/); assert.doesNotMatch(html,/50%/);
});
