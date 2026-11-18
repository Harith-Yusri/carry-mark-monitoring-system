import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';
async function compile(path) {
 const source=(await readFile(path,'utf8')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.env.DEV','false');
 return (await transform(source,{loader:path.endsWith('tsx')?'tsx':'ts',format:'cjs'})).code;
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
test('released-cell API uses server context, version and reason; release reuses existing RPC',async()=>{
 const calls=[];const context={section_id:'section',enrolment_id:'enrol',assessment_id:'assessment',version:7};
 const api=new Function('requireSupabase','module',await compile('src/services/markCorrectionApi.ts')+';return module.exports;')(
  ()=>({rpc:async(...args)=>{calls.push(args);return {data:context,error:null}}}),{exports:{}});
 assert.equal(await api.loadReleasedMarkCorrection({sectionId:'section',enrolmentId:'enrol',assessmentId:'assessment'}),context);
 assert.equal(await api.saveReleasedMarkCorrection(context,0,'  Entry checked  '),context);
 await api.releaseCorrection('request');
 assert.deepEqual(calls,[
  ['get_released_mark_correction_context',{target_section:'section',target_enrolment:'enrol',target_assessment:'assessment'}],
  ['stage_released_mark_correction',{target_section:'section',target_enrolment:'enrol',target_assessment:'assessment',expected_version:7,new_score:0,correction_reason:'Entry checked'}],
  ['release_corrected_mark',{target_request:'request'}],
 ]);
});
test('released grid keeps disabled inputs and exact secondary Edit controls, including zero; draft grid has none',async()=>{
 const icon=()=>null;
 const dependencies={React,W:{panel:'panel',secondary:'secondary',primary:'primary'},...Object.fromEntries(['ChevronLeft','CheckCircle','RefreshCw','KeyRound','Check','Copy'].map(name=>[name,icon]))};
 const Grid=new Function(...Object.keys(dependencies),'module',await compile('src/features/lecturer/MarksEntryTab.tsx')+';return MarkGrid;')(...Object.values(dependencies),{exports:{}});
 const student={id:'enrol',enrolmentId:'enrol',name:'Student',matrixNo:'ST001',scores:{a:50,b:0,c:null},totalCarry:25,eligible:false};
 const edits=[];
 const props={assessments:['a','b','c'].map(id=>({id,name:id,maxMarks:100})),carryMax:50,sections:[],selected:{id:'class',label:'A',programmeCode:'CS240',students:[student],finalised:true},onEditMark:(...args)=>edits.push(args)};
 const tree=Grid(props),inputs=nodes(tree).filter(n=>n.type==='input'),buttons=nodes(tree).filter(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Edit released mark'));
 assert.equal(inputs.length,3);assert.ok(inputs.every(n=>n.props.disabled));assert.equal(buttons.length,3);
 assert.equal(buttons[0].props.disabled,false);assert.equal(buttons[1].props.disabled,false);assert.equal(buttons[2].props.disabled,true);
 assert.doesNotMatch(buttons[0].props.className,/staff-primary-action/);
 buttons[0].props.onClick();buttons[1].props.onClick();assert.deepEqual(edits,[[student,'a'],[student,'b']]);
 const draft=Grid({...props,selected:{...props.selected,finalised:false}});
 assert.equal(nodes(draft).filter(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Edit released mark')).length,0);
 assert.ok(nodes(draft).filter(n=>n.type==='input').every(n=>n.props.disabled===false));
});
