import { localizedFunction } from './helpers/localization.mjs';
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

async function lecturer(status, { editable = true, can_correct = true } = {}) {
  const item = { ...issue(status), status: status === 'released' ? 'resolved' : 'submitted', editable, can_correct }; const states = [[item], false]; let cursor = 0;
  const guard = { current: false }; const calls = [];
  const dependencies = {
    React, useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: () => guard, useEffect: () => {}, useCallback: fn => fn, W: {}, correctionError: () => 'Safe error',
    loadMarkIssues: async () => [item], window: { confirm: () => true },
  };
  for (const fn of ['correctIssue', 'respondToIssue', 'releaseCorrection']) dependencies[fn] = async (...args) => { calls.push([fn, ...args]); };
  const Component = localizedFunction(...Object.keys(dependencies), 'module', await compile('src/features/lecturer/MarkIssuesTab.tsx') + ';return module.exports.MarkIssuesTab;')(...Object.values(dependencies), { exports: {} });
  const render = () => { cursor = 0; return Component({ offeringId: 'owned-offering' }); };
  const button = label => nodes(render()).find(n => n.type === 'button' && text(n) === label);
  return { render, button, calls, item };
}
test('a new report has only Reject and Correct Mark outcomes, both require a reason', async () => {
  const initial = await lecturer();
  for (const label of ['Mark as Reviewing', 'Resolve', 'Request Mark Correction', 'Save Correction']) assert.equal(initial.button(label), undefined);
  assert.equal(initial.button('Reject').props.disabled, true);
  assert.equal(initial.button('Correct Mark').props.disabled, true);
  nodes(initial.render()).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Evidence reviewed' } });
  assert.equal(initial.button('Reject').props.disabled, false);
  initial.button('Reject').props.onClick(); await tick();
  assert.deepEqual(initial.calls, [['respondToIssue', 'issue-1', 'rejected', 'Evidence reviewed']]);
});
test('correction validates the exact score, stages privately, then requires explicit release', async () => {
  for (const legacyStatus of [undefined, 'pending', 'approved', 'rejected']) {
    const screen = await lecturer(legacyStatus);
    assert.ok(screen.button('Correct Mark'));
    assert.equal(screen.button('Release Updated Mark'), undefined);
    nodes(screen.render()).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Checked the script' } });
    const input = nodes(screen.render()).find(n => n.type === 'input');
    assert.equal(input.props.max, 10);
    for (const value of ['', '-1', '11', '9.001', 'NaN', 'Infinity', '7']) {
      input.props.onChange({ target: { value } });
      assert.equal(screen.button('Correct Mark').props.disabled, true, value);
    }
    input.props.onChange({ target: { value: '9' } });
    assert.equal(screen.button('Correct Mark').props.disabled, false);
    const handler = screen.button('Correct Mark').props.onClick;
    handler(); handler(); await tick();
    assert.deepEqual(screen.calls, [['correctIssue', 'issue-1', 9, 'Checked the script']]);
  }
  const corrected = await lecturer('corrected');
  assert.equal(corrected.button('Correct Mark'), undefined);
  assert.equal(nodes(corrected.render()).some(n => n.type === 'input'), false);
  const release = corrected.button('Release Updated Mark').props.onClick;
  release(); release(); await tick();
  assert.deepEqual(corrected.calls, [['releaseCorrection', 'request-1']]);
  assert.match(text(corrected.render()), /private until released/);
  const released = await lecturer('released');
  for (const label of ['Correct Mark', 'Reject', 'Release Updated Mark']) assert.equal(released.button(label), undefined);
  for (const status of [undefined, 'pending', 'approved', 'corrected']) {
    const archived = await lecturer(status, { editable: false });
    for (const label of ['Correct Mark', 'Reject', 'Release Updated Mark']) assert.equal(archived.button(label), undefined);
  }
});
test('unlinked or unreleased reports permit rejection but cannot stage a correction', async () => {
  const screen = await lecturer(undefined, { can_correct: false });
  nodes(screen.render()).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Existing score checked.' } });
  assert.equal(screen.button('Reject').props.disabled, false);
  assert.equal(screen.button('Correct Mark').props.disabled, true);
  assert.equal(nodes(screen.render()).some(n => n.type === 'input'), false);
});
test('staff API stages only the reported issue with score and trimmed reason', async () => {
  const calls = [];
  const api = localizedFunction('requireSupabase', 'module', await compile('src/services/markCorrectionApi.ts') + ';return module.exports;')(
    () => ({ rpc: async (...args) => { calls.push(args); return { error: null }; } }), { exports: {} });
  await api.correctIssue('issue-1', 0, '  Entry error confirmed  ');
  await api.respondToIssue('issue-2', 'rejected', '  Script checked  ');
  await api.releaseCorrection('correction-1');
  assert.deepEqual(calls, [
    ['stage_mark_issue_correction', { target_issue: 'issue-1', new_score: 0, correction_reason: 'Entry error confirmed' }],
    ['respond_to_mark_issue', { target_issue: 'issue-2', decision: 'rejected', lecturer_response: 'Script checked' }],
    ['release_corrected_mark', { target_request: 'correction-1' }],
  ]);
});
test('Admin portal has no correction queue, badge reads, or review actions', async () => {
  const source = await readFile('src/features/admin/AdminWebPortal.tsx', 'utf8');
  assert.doesNotMatch(source, /MarkCorrectionQueue|Mark Corrections|pendingCorrections|loadCorrectionPendingCount/);
  const api = await readFile('src/services/markCorrectionApi.ts', 'utf8');
  assert.doesNotMatch(api, /request_mark_correction|review_mark_correction|update_approved_mark|get_mark_correction_queue|get_mark_correction_pending_count/);
});

test('student status history exposes progress and own responses without private draft data', async () => {
  const calls = []; const api = localizedFunction('supabase', 'recordAuthActivity', '__DEV__', 'module', await compile('student-mobile-expo/src/services/markIssues.ts') + ';return module.exports;')({ rpc: async (...args) => { calls.push(args); return { data: 'report-id', error: null }; } }, async () => { throw new Error('Local storage unavailable'); }, false, { exports: {} });
  await api.submitStudentMarkIssue('enrolment', 'assessment', '  Please review  ', 'request-key');
  assert.deepEqual(calls[0], ['submit_student_mark_issue', { target_enrolment: 'enrolment', target_assessment: 'assessment', explanation: 'Please review', request_key: 'request-key' }]);
  for (const [status, label] of [['pending', 'Submitted'], ['approved', 'Submitted'], ['rejected', 'Submitted'], ['corrected', 'Awaiting updated mark release'], ['released', 'Corrected']]) assert.equal(api.markIssueStatus({ status: 'reviewing', correction_status: status }), label);
  assert.equal(api.markIssueStatus({ status: 'resolved', correction_status: 'rejected' }), 'Closed');
  assert.equal(api.markIssueError({ message: 'CAMS: Select an assessment belonging to this class.' }), 'Select an assessment belonging to this class.');
  assert.ok(!api.markIssueError({ message: 'URL: https://internal Headers: secret' }).includes('internal'));
});
