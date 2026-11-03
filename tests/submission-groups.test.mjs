import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';

const { code: groupCode } = await transform(await readFile('src/features/admin/submissionGroups.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
const { groupSubmissionRows } = new Function('module', groupCode + ';return module.exports;')({ exports: {} });
const row = (id, staffId, submissionStatus, programmeCode = 'CS240') => ({
  id, staffId, lecturerName: `Lecturer ${staffId}`, submissionStatus, programmeCode,
  programmeName: 'Programme', subjectCode: 'ITT557', subjectName: 'Mobile Development',
  classLabel: `Class ${id}`, completionRate: submissionStatus === 'Finalised' ? 100 : 20,
  lastUpdated: '19 Oct, 6:56 AM',
});
const rows = [row('1','S1','Finalised'), row('2','S2','Finalised'), row('3','S1','Overdue','CS255'), row('4','S3','Pending')];

test('lecturer groups preserve every class and derive only presentation summaries', () => {
  const groups = groupSubmissionRows(rows);
  assert.deepEqual(groups.map(g => [g.staffId,g.finalised,g.attention,g.status]), [
    ['S1',1,1,'Partially Finalised'], ['S2',1,0,'Finalised'], ['S3',0,1,'Action Required'],
  ]);
  assert.equal(groups.flatMap(g => g.classes).length, rows.length);
  assert.strictEqual(groups[0].classes[0], rows[0]);
  assert.strictEqual(groups[0].classes[1], rows[2]);
  assert.deepEqual(groupSubmissionRows([]), []);
});

test('filtered summaries exclude nonmatching classes and lecturers', () => {
  const groups = groupSubmissionRows(rows.filter(r => r.programmeCode === 'CS255'));
  assert.equal(groups.length, 1);
  assert.deepEqual([groups[0].finalised, groups[0].attention, groups[0].status], [0,1,'Action Required']);
});

const source = (await readFile('src/features/admin/SubmissionMonitor.tsx', 'utf8')).replace(/^import .*;\n/gm, '').replace('export function SubmissionMonitor', 'function SubmissionMonitor');
const { code: componentCode } = await transform(source, { loader: 'tsx' });
const { code: recordsCode } = await transform(await readFile('src/hooks/useAdminRecords.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
const recordExports = new Function('module','require', recordsCode + ';return module.exports;')({exports:{}}, () => ({}));
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
function setup() {
  const state = []; let cursor = 0; const calls = [];
  const useState = initial => {const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}];};
  const colors = () => ({display:'Inter',sans:'Inter'});
  const deps = {React,useMemo:fn=>fn(),useState,useColors:colors,useCardColors:colors,groupSubmissionRows,
    submissionAllocations:recordExports.submissionAllocations,requiresSubmissionAction:recordExports.requiresSubmissionAction,
    useReminders:()=>({sendReminder:id=>calls.push(id),sentReminders:new Set(),sendingReminders:new Set(),reminderError:''}),
    AdminStatus:()=>null,CheckCircle:()=>null,Clock:()=>null,Send:()=>null,ChevronDown:()=>null};
  const Component = new Function(...Object.keys(deps), componentCode+';return SubmissionMonitor;')(...Object.values(deps));
  const records = ['S1','S2','S3'].map(id=>({id,name:`Lecturer ${id}`,classAllocations:rows.filter(r=>r.staffId===id)}));
  const render = () => {cursor=0;return Component({records,context:{programmes:[{code:'CS240',name:'Programme'},{code:'CS255',name:'Other Programme'}]},loading:false,error:''});};
  return {render,calls};
}

test('real monitor preserves row actions, accessible collapse, and filter behavior', () => {
  const ui=setup();
  const getNodes=()=>nodes(ui.render());
  let groups=getNodes().filter(n=>n.type==='section');
  assert.equal(groups.length,3);
  const controls=()=>getNodes().filter(n=>n.type==='button'&&'aria-expanded' in n.props);
  assert(controls().every(n=>!n.props['aria-expanded']));
  assert(getNodes().some(n=>n.props?.id===controls()[0].props['aria-controls']&&n.props.hidden));
  controls()[0].props.onClick();
  assert.equal(controls()[0].props['aria-expanded'],true);
  assert(getNodes().some(n=>n.props?.id===controls()[0].props['aria-controls']&&!n.props.hidden));
  controls()[0].props.onClick();
  assert.equal(controls()[0].props['aria-expanded'],false);
  controls()[0].props.onClick();
  const buttons=getNodes().filter(n=>n.type==='button');
  const reminder=buttons.find(n=>React.Children.toArray(n.props.children).includes('Send Reminder'));
  reminder.props.onClick();assert.deepEqual(ui.calls,['S1']);
  getNodes().find(n=>n.type==='select').props.onChange({target:{value:'CS255'}});
  groups=getNodes().filter(n=>n.type==='section');assert.equal(groups.length,1);
  assert.equal(controls()[0].props['aria-expanded'],true, 'Explicit expansion survives filtering');
  assert.equal(getNodes().filter(n=>n.type==='tbody').flatMap(n=>React.Children.toArray(n.props.children)).length,1);
  getNodes().find(n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Released')).props.onClick();
  assert.equal(getNodes().filter(n=>n.type==='section').length,0);
  assert(getNodes().some(n=>n.props?.role==='status'));
  getNodes().find(n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('All')).props.onClick();
  getNodes().find(n=>n.type==='select').props.onChange({target:{value:''}});
  assert.deepEqual(controls().map(n=>n.props['aria-expanded']),[true,false,false]);
  controls()[0].props.onClick();
  getNodes().find(n=>n.type==='select').props.onChange({target:{value:'CS255'}});
  assert.equal(controls()[0].props['aria-expanded'],false, 'Explicit collapse survives filtering');
});
