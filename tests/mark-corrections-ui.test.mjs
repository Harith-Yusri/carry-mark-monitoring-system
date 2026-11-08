import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';

async function compile(path) {
  const source = (await readFile(path, 'utf8')).replace(/^import[\s\S]*?;\n/gm, '').replaceAll('import.meta.env.DEV', 'false');
  return (await transform(source, { loader: path.endsWith('tsx') ? 'tsx' : 'ts', format: 'cjs', jsx: 'transform' })).code;
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
const text = node => React.Children.toArray(node.props?.children).map(child => typeof child === 'object' ? text(child) : child).join('');
const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = { student_name: 'Fixture', student_number: 'ST001', subject_code: 'ITT550', subject_name: 'Network Design', class_label: 'Class A', assessment_name: 'Quiz One', lecturer_name: 'Lecturer', academic_year: '2026/2027', semester_code: '20264' };
const correction = status => ({ id: 'request-1', dispute_id: 'issue-1', status, reason: 'Initial entry incorrect', original_score: 7, maximum_score: 10, corrected_score: status === 'corrected' || status === 'released' ? 9 : null, requested_at: '2026-11-08T01:00:00Z', snapshot, events: [], editable: true });
const issue = status => ({ id: 'issue-1', status: 'reviewing', explanation: 'Please review', student_name: 'Fixture', student_number: 'ST001', assessment_name: 'Quiz One', class_label: 'Class A', current_score: 7, maximum_score: 10, created_at: '2026-11-08T01:00:00Z', response: null, editable: true, can_correct: true, corrections: status ? [correction(status)] : [] });

async function lecturer(status, { editable = true } = {}) {
  const item = { ...issue(status), editable }; const states = [[item], false]; let cursor = 0;
  const guard = { current: false }; const calls = [];
  const dependencies = {
    React, useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: () => guard, useEffect: () => {}, useCallback: fn => fn, W: {}, correctionError: () => 'Safe error',
    loadMarkIssues: async () => [item], window: { confirm: () => true },
  };
  for (const fn of ['requestCorrection', 'respondToIssue', 'saveCorrection', 'releaseCorrection']) dependencies[fn] = async (...args) => { calls.push([fn, ...args]); };
  const Component = new Function(...Object.keys(dependencies), 'module', await compile('src/features/lecturer/MarkIssuesTab.tsx') + ';return module.exports.MarkIssuesTab;')(...Object.values(dependencies), { exports: {} });
  const render = () => { cursor = 0; return Component({ offeringId: 'owned-offering' }); };
  const button = label => nodes(render()).find(n => n.type === 'button' && text(n) === label);
  return { render, button, calls, item };
}
test('Mark Issues exposes report review but never edits a Released mark while approval is pending', async () => {
  const initial = await lecturer();
  assert.ok(initial.button('Request Mark Correction'));
  assert.equal(initial.button('Request Mark Correction').props.disabled, true);
  nodes(initial.render()).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Evidence reviewed' } });
  initial.button('Mark as Reviewing').props.onClick(); await tick();
  assert.deepEqual(initial.calls[0], ['respondToIssue', 'issue-1', 'reviewing', 'Evidence reviewed']);
  initial.button('Request Mark Correction').props.onClick(); await tick();
  assert.deepEqual(initial.calls[1], ['requestCorrection', 'issue-1', 'Evidence reviewed']);
  const pending = await lecturer('pending');
  assert.equal(pending.button('Save Correction'), undefined); assert.equal(pending.button('Release Updated Mark'), undefined);
  assert.equal(pending.button('Request Mark Correction'), undefined);
  assert.ok(nodes(pending.render()).some(n => typeof n.props?.children === 'string' && n.props.children.includes('Awaiting Admin Approval')));
});
test('only approved requests show correction input; save and re-release are separate actions', async () => {
  const approved = await lecturer('approved');
  assert.ok(approved.button('Save Correction')); assert.equal(approved.button('Release Updated Mark'), undefined);
  const input = nodes(approved.render()).find(n => n.type === 'input');
  assert.equal(input.props.max, 10); input.props.onChange({ target: { value: '11' } });
  assert.equal(approved.button('Save Correction').props.disabled, true);
  input.props.onChange({ target: { value: '9' } });
  const handler = approved.button('Save Correction').props.onClick;
  handler(); handler(); await tick();
  assert.deepEqual(approved.calls, [['saveCorrection', 'request-1', 9]]);
  const corrected = await lecturer('corrected'); assert.equal(corrected.button('Save Correction'), undefined);
  corrected.button('Release Updated Mark').props.onClick(); await tick();
  assert.deepEqual(corrected.calls, [['releaseCorrection', 'request-1']]);
  for (const state of ['rejected', 'released']) assert.equal((await lecturer(state)).button('Save Correction'), undefined);
  const archived = await lecturer('approved', { editable: false }); assert.equal(archived.button('Save Correction'), undefined);
});

test('Admin queue confirms review decisions and blocks concurrent submissions', async () => {
  const states = [[correction('pending')], '', false]; let cursor = 0; const guard = { current: false }; const calls = [];
  const dependencies = { React, useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: () => guard, useEffect: () => {}, useCallback: fn => fn, W: {}, correctionError: () => 'Safe error',
    loadCorrectionQueue: async () => [correction('approved')], reviewCorrection: async (...args) => calls.push(args), window: { confirm: () => true },
  };
  const Component = new Function(...Object.keys(dependencies), 'module', await compile('src/features/admin/MarkCorrectionQueue.tsx') + ';return module.exports.MarkCorrectionQueue;')(...Object.values(dependencies), { exports: {} });
  const render = () => { cursor = 0; return Component({ onChanged() {} }); };
  const handler = nodes(render()).find(n => n.type === 'button' && text(n) === 'Approve').props.onClick;
  handler(); handler(); await tick();
  assert.deepEqual(calls, [['request-1', true, '']]);
  assert.equal(nodes(render()).some(n => n.type === 'button' && text(n) === 'Approve'), false);
});

test('student status history exposes progress and own responses without private draft data', async () => {
  const calls = []; const api = new Function('supabase', 'recordAuthActivity', '__DEV__', 'module', await compile('student-mobile-expo/src/services/markIssues.ts') + ';return module.exports;')({ rpc: async (...args) => { calls.push(args); return { data: 'report-id', error: null }; } }, async () => { throw new Error('Local storage unavailable'); }, false, { exports: {} });
  await api.submitStudentMarkIssue('enrolment', 'assessment', '  Please review  ', 'request-key');
  assert.deepEqual(calls[0], ['submit_student_mark_issue', { target_enrolment: 'enrolment', target_assessment: 'assessment', explanation: 'Please review', request_key: 'request-key' }]);
  for (const [status, label] of [['pending', 'Correction Requested'], ['approved', 'Correction Approved'], ['rejected', 'Correction Rejected'], ['corrected', 'Corrected · awaiting release'], ['released', 'Resolved']]) assert.equal(api.markIssueStatus({ status: 'reviewing', correction_status: status }), label);
  assert.equal(api.markIssueStatus({ status: 'resolved', correction_status: 'rejected' }), 'Resolved');
  assert.equal(api.markIssueError({ message: 'CAMS: Select an assessment belonging to this class.' }), 'Select an assessment belonging to this class.');
  assert.ok(!api.markIssueError({ message: 'URL: https://internal Headers: secret' }).includes('internal'));
});
