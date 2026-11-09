import { InitialDataState, LoadingState, RefreshStatus } from './helpers/staff-loading.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { code } = await transform(await readFile('src/services/lecturerSubjectGroups.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
const { groupLecturerSubjects } = new Function('module', code + '; return module.exports;')({ exports: {} });
const { code: styleCode } = await transform(await readFile('src/features/lecturer/workspaceStyles.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
const { workspace: W } = new Function('module', styleCode + ';return module.exports;')({ exports: {} });
const row = (id, programme, changes = {}) => ({ offeringId: id, code: 'ITT550', name: 'Network Design and Management',
  programmeId: programme, programmeIds: [programme], programmeCode: programme, programmeCodes: [programme], programmeNames: [programme],
  progSem: 5, semesterNo: 2, academicYear: '2025/2026', students: 6, status: 'active', lastSync: null, ...changes });

test('Nor Hafizah shape: three offerings become one subject without losing original IDs', () => {
  const rows = [row('a','CS240'), row('b','CS251'), row('c','CS255')];
  const before = JSON.stringify(rows);
  const result = groupLecturerSubjects(rows);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].offerings, rows);
  assert.equal(result[0].students, 18);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(groupLecturerSubjects([...rows, rows[0]])[0].students, 18);
});

test('Rashidah shape: a single mixed-programme offering remains exactly the same object', () => {
  const original = row('rashidah', 'CS240', { programmeIds: ['CS240','CS255'], programmeCodes: ['CS240','CS255'] });
  assert.equal(groupLecturerSubjects([original])[0], original);
});

test('different subject, programme semester or academic term never merges; mixed status stays in progress', () => {
  assert.equal(groupLecturerSubjects([row('a','CS240'), row('b','CS251',{progSem:6}), row('c','CS240',{code:'ICT662'}),row('d','CS240',{academicYear:'2026/2027'})]).length,4);
  assert.equal(groupLecturerSubjects([row('a','CS240',{status:'submitted'}),row('b','CS251')])[0].status,'active');
  assert.equal(groupLecturerSubjects([row('a','CS240',{status:'submitted'}),row('b','CS251',{status:'submitted'})])[0].status,'submitted');
});

function nodes(tree) {
  return !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}

test('combined Marks Entry grid keeps class IDs, programme, capacity and each assessment context', async () => {
  const source = (await readFile('src/features/lecturer/MarksEntryTab.tsx','utf8')).replace(/^import .*;\n/gm,'').replace('export function MarksEntryTab','function MarksEntryTab');
  const { code } = await transform(source, {loader:'tsx'});
  const sections = [
    {id:'class-a', label:'Class A', programmeId:'CS240', programmeCode:'CS240', capacity:10, joinCode:'JOIN-A', students:[],finalised:false},
    {id:'class-b', label:'Class B', programmeId:'CS251', programmeCode:'CS251', capacity:20, joinCode:'JOIN-B', students:[],finalised:true},
  ];
  const allocations = sections.map((section,index)=>({offeringId:`offering-${index}`,data:{sections:[section],assessments:[{id:`assessment-${index}`,name:`Assessment ${index}`,maxMarks:100,weightage:50}]},settings:{carryMax:50,eligibleThreshold:40}}));
  const summaries=sections.map((section,index)=>({...section,offeringId:`offering-${index}`,studentCount:section.students.length}));
  let selectedId=null;
  const releaseCalls=[]; let reloads=0;
  const states=[];
  let cursor=0, effects=[];
  const useState=initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]};
  const icon=()=>null;
  const deps={React,W,InitialDataState,LoadingState,RefreshStatus,useState,finaliseSection:async id=>releaseCalls.push(id),useEffect:fn=>effects.push(fn),useRef:()=>({current:null}),useColors:()=>({}),useAuth:()=>({user:{authId:'lecturer'}}),
    useSubjectClassData:()=>{const selected=sections.find(section=>section.id===selectedId)??null;const allocation=allocations.find(a=>a.data.sections.some(s=>s.id===selectedId));return {hasLoaded:true,sections:summaries,selectedId,setSelectedId:id=>{selectedId=id},selected,assessments:allocation?.data.assessments??[],carryMax:50,eligibleThreshold:40,loading:false,detailLoading:false,error:'',reload:async()=>{reloads++},updateDetailedSections:()=>{}}},
    classSelectorCardStyle:{},classSelectorGridStyle:{},classSelectorIconStyle:{},classSelectorMetaStyle:{},classSelectorTitleStyle:{},classSelectorActionStyle:{},
    ...Object.fromEntries(['Check','CheckCircle','ChevronLeft','ChevronRight','Copy','KeyRound','MoreVertical','Plus','RefreshCw','Users','X'].map(name=>[name,icon]))};
  const Component=new Function(...Object.keys(deps),code+';return MarksEntryTab;')(...Object.values(deps));
  const render=()=>{cursor=0;effects=[];return Component({offeringId:'offering-0',offeringIds:['offering-0','offering-1'],offeringProgrammeId:'CS240',subjectCode:'ITT550'})};
  let tree=render();
  assert.equal(nodes(tree).filter(n=>n.props?.role==='button').length,2);
  const html=renderToStaticMarkup(tree);
  assert.match(html,/<strong[^>]*>CS240<\/strong> · 0 enrolled · capacity 10/);
  assert.match(html,/<strong[^>]*>CS251<\/strong> · 0 enrolled · capacity 20/);
  const pendingCard = nodes(tree).find(n=>n.props?.['aria-label']==='Enter marks for Class A');
  const finalisedCard = nodes(tree).find(n=>n.props?.['aria-label']==='Enter marks for Class B');
  assert.match(renderToStaticMarkup(pendingCard), /aria-label="Class marks pending"[^>]*>PENDING<\/span>/);
  assert.doesNotMatch(renderToStaticMarkup(pendingCard), />RELEASED<\/span>/);
  assert.match(renderToStaticMarkup(finalisedCard), /aria-label="Class marks released"[^>]*>RELEASED<\/span>/);
  assert.doesNotMatch(renderToStaticMarkup(finalisedCard), />PENDING<\/span>/);
  nodes(tree).find(n=>n.props?.['aria-label']==='Enter marks for Class B').props.onClick();
  tree=render();
  const grid=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='MarkGrid');
  assert.equal(grid.props.selected.id,'class-b');
  assert.equal(grid.props.selected.finalised,true);
  assert.equal(grid.props.selected.joinCode,'JOIN-B');
  assert.equal(grid.props.assessments[0].id,'assessment-1');
  const previousWindow=globalThis.window;
  const confirmations=[];
  try {
    globalThis.window={confirm:message=>{confirmations.push(message);return true}};
    await grid.props.finalise();
    assert.deepEqual(releaseCalls,[], 'Released classes cannot be released again');
    selectedId='class-a';
    const pendingGrid=nodes(render()).find(n=>typeof n.type==='function'&&n.type.name==='MarkGrid');
    await pendingGrid.props.finalise();
    assert.deepEqual(releaseCalls,['class-a']);
    assert.equal(reloads,1);
    assert.match(confirmations[0],/^Release carry marks for Class A/);
    assert.match(confirmations[0],/students will be notified/);
    assert.doesNotMatch(confirmations[0],/finalis|finaliz/i);
  } finally {
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  }

});

test('Export class selector includes all programmes and uses the selected class assessment IDs', async () => {
  const source = (await readFile('src/features/lecturer/ExportTab.tsx','utf8')).replace(/^import .*;\n/gm,'').replace('export function ExportTab','function ExportTab');
  const { code } = await transform(source,{loader:'tsx'});
  const sections=['CS240','CS251'].map((programmeCode,index)=>({id:`class-${index}`,programmeCode,programmeName:programmeCode,label:`Class ${index}`,capacity:10,students:[],finalised:false}));
  const allocations=sections.map((section,index)=>({offeringId:`offering-${index}`,data:{sections:[section],assessments:[{id:`assessment-${index}`,name:`Assessment ${index}`,maxMarks:100}]},settings:{carryMax:50}}));
  const summaries=sections.map((section,index)=>({...section,offeringId:`offering-${index}`,studentCount:section.students.length}));
  let selectedId=null;
  const releaseCalls=[]; let reloads=0;const states=[];let cursor=0,effects=[];
  const useState=initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]};
  const icon=()=>null;
  const deps={React,W,InitialDataState,LoadingState,RefreshStatus,useState,useEffect:fn=>effects.push(fn),useColors:()=>({}),useSubjectClassData:()=>{const selected=sections.find(section=>section.id===selectedId)??null;const allocation=allocations.find(a=>a.data.sections.some(s=>s.id===selectedId));return {hasLoaded:true,sections:summaries,selectedId,setSelectedId:id=>{selectedId=id},selected,assessments:allocation?.data.assessments??[],carryMax:50,loading:false,error:'',reload:async()=>{}}},classSelectorCardStyle:{},classSelectorGridStyle:{},classSelectorIconStyle:{},classSelectorMetaStyle:{},classSelectorTitleStyle:{},classSelectorActionStyle:{},
    ...Object.fromEntries(['CheckCircle','ChevronLeft','ChevronRight','Download','Users'].map(name=>[name,icon]))};
  const Component=new Function(...Object.keys(deps),code+';return ExportTab;')(...Object.values(deps));
  const render=()=>{cursor=0;effects=[];return Component({offeringId:'offering-0',offeringIds:['offering-0','offering-1'],subjectCode:'ITT550',subjectName:'Network Design',academicYear:'2025/2026',programmeSemester:5})};
  let tree=render();const html=renderToStaticMarkup(tree);
  assert.match(html,/<strong[^>]*>CS240<\/strong>/);assert.match(html,/<strong[^>]*>CS251<\/strong>/);
  const buttons=nodes(tree).filter(node=>node.type==='button');assert.equal(buttons.length,2);
  buttons[1].props.onClick();tree=render();
  const selectedHtml=renderToStaticMarkup(tree);
  assert.match(selectedHtml,/Assessment 1/i);assert.doesNotMatch(selectedHtml,/Assessment 0/i);
  assert.match(selectedHtml,/ITT550_CS251_Class1/);
});
