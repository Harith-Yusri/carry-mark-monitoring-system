import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';

const compile = async path => (await transform(await readFile(path, 'utf8'), { loader: path.endsWith('tsx') ? 'tsx' : 'ts', format: 'cjs' })).code;
const { groupLecturerSubjects } = new Function('module', await compile('src/services/lecturerSubjectGroups.ts') + ';return module.exports;')({ exports: {} });
const { workspace: W } = new Function('module', await compile('src/features/lecturer/workspaceStyles.ts') + ';return module.exports;')({ exports: {} });
const apiCode = await compile('src/services/carryMarkApi.ts');
const source = (await readFile('src/features/lecturer/LecturerDashboard.tsx', 'utf8')).replace(/^import .*;\n/gm, '').replace('export function LecturerDashboard','function LecturerDashboard');
const { code } = await transform(source, { loader: 'tsx' });
const historicalRow = (id, semester=2) => ({offering_id:id,programme_ids:['p1'],programme_codes:['CS240'],programme_names:['Information Technology'],subject_code:'ITT557',subject_name:'Mobile Application Development',programme_semester:4,student_count:6,updated_at:'2026-10-19T00:00:00Z',offering_status:'completed',academic_year:'2025/2026',semester_no:semester});
const payload = {term:{academic_year:'2026/2027',semester_no:1,semester_code:'20271'},current:[],archived:[historicalRow('old-2'),historicalRow('old-1',1)]};
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
function text(tree) {
  if(typeof tree==='string'||typeof tree==='number')return String(tree);
  return tree&&typeof tree==='object'?React.Children.toArray(tree.props?.children).map(text).join(''):'';
}
function setup(dashboard=payload) {
  const states=[];let cursor=0,effectMounted=false;const effects=[],reads=[],writes=[],rpcCalls=[],selected=[];
  const api = new Function('module','require',apiCode+';return module.exports;')({exports:{}},name=>name.includes('lecturerSubjectGroups')?{groupLecturerSubjects}:{requireSupabase:()=>({rpc:async name=>{rpcCalls.push(name);assert.equal(name,'get_my_lecturer_subject_dashboard');return {data:dashboard,error:null}}})});
  const useState=initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]};
  const useRef=initial=>{const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i]};
  const icon=()=>null;
  const failWrite=async()=>{writes.push('unexpected write');throw Error('Archived data must not be mutated')};
  const deps={React,useState,useRef,useEffect:fn=>{if(!effectMounted){effectMounted=true;effects.push(fn)}},useAuth:()=>({user:{name:'Lecturer',id:'L1'}}),W,userError:(e,f)=>e?.message||f,
    loadLecturerSubjectDashboard:api.loadLecturerSubjectDashboard,
    loadOfferingData:async id=>{reads.push(id);return {sections:[{id:'section-'+id,programmeCode:'CS240',label:'Historical Class',students:[{}],finalised:true}],assessments:[{id:'a-'+id,name:'Historical Test',type:'Test',weightage:30}]}},
    loadSubjectCreationData:async()=>({catalogue:[],termLabel:'Semester 1 · 2026/2027'}),listProgrammes:async()=>[],
    listLecturerSubjects:async()=>[],createLecturerSubject:failWrite,updateLecturerSubject:failWrite,deleteLecturerSubject:failWrite,
    ...Object.fromEntries(['BookOpen','Plus','Users','Clock','ChevronRight','MoreVertical','Trash2','X'].map(k=>[k,icon]))};
  const Component=new Function(...Object.keys(deps),code+';return LecturerDashboard;')(...Object.values(deps));
  const render=()=>{cursor=0;return Component({onSelectSubject:s=>selected.push(s)})};
  const all=()=>nodes(render());
  const field=label=>all().find(n=>n.props?.['aria-label']===label);
  const options=label=>React.Children.toArray(field(label).props.children).map(n=>n.props.value);
  const mount=async()=>{render();effects.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve))};
  return {mount,render,all,field,options,reads,writes,rpcCalls,selected};
}

test('new active term without allocations defaults correctly and historical year exposes real semesters read-only', async()=>{
  const ui=setup();await ui.mount();
  assert.deepEqual(ui.rpcCalls,['get_my_lecturer_subject_dashboard']);
  assert.equal(ui.field('Academic year').props.value,'2026/2027');
  assert.equal(ui.field('Semester').props.value,1);
  assert.deepEqual(ui.options('Academic year'),['2026/2027','2025/2026']);
  assert.deepEqual(ui.options('Semester'),[1]);
  assert(ui.all().some(n=>n.type==='button'&&text(n).includes('Create New Subject')));
  ui.field('Academic year').props.onChange({target:{value:'2025/2026'}});
  assert.deepEqual(ui.options('Semester'),[2,1]);
  ui.field('Semester').props.onChange({target:{value:'2'}});
  const cards=ui.all().filter(n=>n.type==='article');assert.equal(cards.length,1);
  assert(text(cards[0]).includes('Mobile Application Development'));
  assert(text(cards[0]).includes('Read-only'));
  assert(!ui.all().some(n=>n.type==='button'&&text(n).includes('Create New Subject')));
  assert(!ui.all().some(n=>n.props?.['aria-label']==='Manage ITT557'));
  await cards[0].props.onClick();
  assert.deepEqual(ui.reads,['old-2']);assert.deepEqual(ui.selected,[]);
  const dialog=ui.all().find(n=>n.props?.['aria-label']==='Archived subject details');
  assert(text(dialog).includes('Historical Class'));assert(text(dialog).includes('Historical Test'));
  assert.equal(nodes(dialog).filter(n=>n.type==='button').length,1,'Only close control in historical detail');
  assert.deepEqual(ui.writes,[]);
  ui.field('Academic year').props.onChange({target:{value:'2026/2027'}});
  assert.equal(ui.field('Semester').props.value,1);
});

test('current allocations remain editable while history stays separate', async()=>{
  const ui=setup({...payload,current:[{...historicalRow('current'),academic_year:'2026/2027',semester_no:1,offering_status:'active'}]});
  await ui.mount();
  const card=ui.all().find(n=>n.type==='article');
  assert(ui.field('Manage ITT557'));
  await card.props.onClick();assert.equal(ui.selected[0].offeringId,'current');
  assert.deepEqual(ui.reads,[]);
  assert.deepEqual(ui.options('Semester'),[1]);
});

test('opening create with no current allocations does not erase the active semester options',async()=>{
  const ui=setup();await ui.mount();
  const button=ui.all().find(n=>n.type==='button'&&text(n).includes('Create New Subject'));
  const pending=button.props.onClick();
  assert.equal(ui.field('Academic year').props.value,'2026/2027');
  assert.deepEqual(ui.options('Semester'),[1]);
  await pending;
  assert.deepEqual(ui.options('Semester'),[1]);
});

test('active and historical semesters in the same year remain distinct and historical selection is read-only', async()=>{
  const ui=setup({term:{academic_year:'2025/2026',semester_no:2,semester_code:'20262'},current:[],archived:[historicalRow('old-1',1)]});
  await ui.mount();
  assert.equal(ui.field('Academic year').props.value,'2025/2026');
  assert.equal(ui.field('Semester').props.value,2);
  assert.deepEqual(ui.options('Semester'),[2,1]);
  ui.field('Semester').props.onChange({target:{value:'1'}});
  assert(ui.all().some(n=>n.type==='article'&&text(n).includes('Read-only')));
  assert(!ui.all().some(n=>n.type==='button'&&text(n).includes('Create New Subject')));
  assert(!ui.field('Manage ITT557'));
});
