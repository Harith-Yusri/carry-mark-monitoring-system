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
function setup({ reject = false } = {}) {
  const states = []; let cursor = 0; const calls = [];
  const useState = initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; };
  const useRef = initial => { const i = cursor++; if (!(i in states)) states[i] = { current: initial }; return states[i]; };
  const icon = () => null;
  const catalogue = [{ code: 'ITT593', name: 'Database Systems', programme_semester: 5, is_active: true }];
  const create = async (...args) => { calls.push(args); if (reject) throw { message: 'You have already added this subject for the current academic term.' }; return 'offering'; };
  const Component = new Function('React','useState','useRef','useEffect','useColors','useAuth','BookOpen','Plus','CheckCircle','ChevronRight','X','listLecturerSubjects','loadSubjectCreationData','createLecturerSubject',code+'; return LecturerDashboard;')(
    React,useState,useRef,()=>{},()=>({}),()=>({ user: { name: 'Test', id: 'TS004' } }),icon,icon,icon,icon,icon,
    async()=>[],async()=>({ catalogue, termLabel: 'Semester 2, 2025/2026' }),create,
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
