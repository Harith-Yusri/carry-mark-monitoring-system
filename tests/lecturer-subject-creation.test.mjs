import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise production event handlers with in-memory state and stubbed API boundaries.
const source = (await readFile(new URL('../src/features/lecturer/LecturerDashboard.tsx', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export function LecturerDashboard', 'function LecturerDashboard');
const { code } = await transform(source, { loader: 'tsx', jsx: 'transform' });
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
function setup({ reject = false, subjects = [] } = {}) {
  const states = []; let cursor = 0; const calls = [];
  states[3] = subjects;
  let serverSubjects = subjects;
  const useState = initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; };
  const useRef = initial => { const i = cursor++; if (!(i in states)) states[i] = { current: initial }; return states[i]; };
  const icon = () => null;
  const catalogue = [{ code: 'ITT593', name: 'Database Systems', programme_semester: 5, is_active: true }];
  const programmes = [{ id: 'programme-1', code: 'CS240', name: 'Bachelor Of Information Technology (Hons.)' }];
  const create = async (...args) => { calls.push(args); if (reject) throw { message: 'You have already added this subject for the current academic term.' }; return 'offering'; };
  const update = async (...args) => {
    calls.push(args);
    const [offeringId, savedName, savedSemester] = args;
    serverSubjects = serverSubjects.map(subject => subject.offeringId === offeringId ? {
      ...subject,
      name: savedName,
      progSem: savedSemester,
    } : subject);
  };
  const Component = new Function('React','useState','useRef','useEffect','useColors','useAuth','BookOpen','Plus','CheckCircle','ChevronRight','MoreVertical','X','listLecturerSubjects','loadSubjectCreationData','createLecturerSubject','updateLecturerSubject',code+'; return LecturerDashboard;')(
    React,useState,useRef,()=>{},()=>({}),()=>({ user: { name: 'Test', id: 'TS004' } }),icon,icon,icon,icon,icon,icon,
    async()=>serverSubjects,async()=>({ catalogue, programmes, termLabel: 'Semester 2, 2025/2026' }),create,update,
  );
  const render = () => { cursor = 0; return Component({ onSelectSubject() {} }); };
  const field = label => nodes(render()).find(node => node.props?.['aria-label'] === label);
  const open = async () => nodes(render()).find(node => node.type === 'button' && React.Children.toArray(node.props.children).includes(' Create New Subject')).props.onClick();
  const submit = () => nodes(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  return { render, field, open, submit, calls };
}
test('existing code fills registered details and saves an assignment', async () => {
  const ui = setup(); await ui.open();
  ui.field('Subject code').props.onChange({ target: { value: 'itt593' } });
  assert.equal(ui.field('Subject name').props.value, 'Database Systems');
  assert.equal(ui.field('Subject name').props.disabled, true);
  assert.equal(ui.field('Programme semester').props.value, '5');
  assert.match(renderToStaticMarkup(ui.render()), /already registered/);
  await ui.submit();
  assert.deepEqual(ui.calls, [['ITT593', 'Database Systems', 5]]);
  assert.equal(nodes(ui.render()).some(node => node.props?.role === 'dialog'), false);
});
test('new subject sends entered details and suppresses concurrent saves', async () => {
  const ui = setup(); await ui.open();
  ui.field('Subject code').props.onChange({ target: { value: 'itt600' } });
  ui.field('Subject name').props.onChange({ target: { value: 'Cloud Computing' } });
  ui.field('Programme semester').props.onChange({ target: { value: '6' } });
  await Promise.all([ui.submit(), ui.submit()]);
  assert.deepEqual(ui.calls, [['ITT600', 'Cloud Computing', 6]]);
});
test('duplicate rejection stays visible in the open form', async () => {
  const ui = setup({ reject: true }); await ui.open();
  ui.field('Subject code').props.onChange({ target: { value: 'ITT593' } });
  await ui.submit();
  const html = renderToStaticMarkup(ui.render());
  assert.match(html, /already added this subject/);
  assert.match(html, /role="dialog"/);
});
test('edit subject pre-fills details, saves the owned offering and updates the card', async () => {
  const subject = { offeringId: 'offering-1', programmeId: 'programme-1', programmeCode: 'CS240', programmeName: 'Bachelor Of Information Technology (Hons.)', programmeIds: ['programme-1'], programmeCodes: ['CS240'], programmeNames: ['Bachelor Of Information Technology (Hons.)'], code: 'ITT593', name: 'Database Systems', progSem: 5, students: 20, lastSync: null, status: 'active', termLabel: 'Semester 2, 2025/2026' };
  const ui = setup({ subjects: [subject] });
  nodes(ui.render()).find(node => node.props?.['aria-label'] === 'Manage ITT593').props.onClick({ stopPropagation() {} });
  await nodes(ui.render()).find(node => node.type === 'button' && React.Children.toArray(node.props.children).includes('Edit subject')).props.onClick();
  assert.equal(ui.field('Subject code').props.value, 'ITT593');
  assert.equal(ui.field('Subject code').props.disabled, true);
  assert.equal(ui.field('Subject name').props.value, 'Database Systems');
  assert.equal(ui.field('Programme semester').props.value, '5');
  ui.field('Subject name').props.onChange({ target: { value: 'Advanced Database Systems' } });
  ui.field('Programme semester').props.onChange({ target: { value: '6' } });
  await ui.submit();
  assert.deepEqual(ui.calls, [['offering-1', 'Advanced Database Systems', 6]]);
  assert.match(renderToStaticMarkup(ui.render()), /Advanced Database Systems/);
  assert.equal(nodes(ui.render()).some(node => node.props?.role === 'dialog'), false);
});
