import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
const portalSource = (await readFile('src/features/lecturer/LecturerWebPortal.tsx', 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export function LecturerWebPortal', 'function LecturerWebPortal');
const { code: portalCode } = await transform(portalSource, { loader: 'tsx', jsx: 'transform' });
test('multi-programme Hub has one assessment editor and retains every offering for class marks', () => {
  const offerings = ['CS240', 'CS251', 'CS255'].map((programmeCode, i) => ({ offeringId: `o${i}`, programmeCode }));
  const subject = { ...offerings[0], offerings, code: 'ITT550', name: 'Network Design', progSem: 5 };
  const states = ['subject-hub', subject, 'assessments'];
  let cursor = 0;
  const useState = initial => { const i = cursor++; return [states[i] ?? initial, value => { states[i] = value; }]; };
  const Portal = new Function('React', 'useState', 'lazy', 'Suspense', 'ChevronLeft', 'W', 'useAuth', portalCode + ';return LecturerWebPortal;')(
    React, useState, () => () => null, ({ children }) => children, () => null, {}, () => ({ user: { name: 'Lecturer' } }),
  );
  const render = () => { cursor = 0; return Portal(); };
  const tree = render();
  assert.equal(nodes(tree).filter(n => n.props?.subjectCode === 'ITT550' && !n.props?.offeringIds).length, 1);
  assert.equal(nodes(tree).filter(n => n.type === 'select').length, 0);
  assert.doesNotMatch(JSON.stringify(tree), /Assessment structure for classes in|Assessment allocation/);
  const editor = nodes(tree).find(n => n.props?.subjectCode === 'ITT550');
  assert.equal(editor.props.offeringId, 'o0');
  nodes(tree).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes('Marks Entry & Eligibility')).props.onClick();
  const marks = nodes(render()).find(n => n.props?.subjectCode === 'ITT550');
  assert.deepEqual(marks.props.offeringIds, ['o0', 'o1', 'o2']);
});

const apiSource = (await readFile('src/services/subjectAssessmentApi.ts', 'utf8')).replace(/^import .*;\n/gm, '');
const { code: apiCode } = await transform(apiSource, { loader: 'ts', format: 'cjs' });
function apiSetup(error = null) {
  const calls = [];
  const payload = { assessments: [{ id: 'original-assessment-id' }], carryMax: 70 };
  const api = new Function('requireSupabase', 'module', apiCode + ';return module.exports;')(
    () => ({ rpc: async (...args) => { calls.push(args); return { data: payload, error }; } }), { exports: {} },
  );
  return { api, calls, payload };
}
test('shared editor uses atomic Hub RPCs and retains original assessment identity', async () => {
  const { api, calls, payload } = apiSetup();
  assert.deepEqual(await api.loadAssessmentStructure('hub-anchor'), payload);
  const component = { name: 'Quiz One', type: 'Quiz', maxMarks: 20, weightage: 10 };
  await api.saveAssessment('hub-anchor', component);
  await api.saveAssessment('hub-anchor', component, 'original-assessment-id');
  await api.deleteAssessment('hub-anchor', 'original-assessment-id');
  await api.saveOfferingWeightage('hub-anchor', 70);
  assert.deepEqual(calls.map(c => c[0]), ['get_my_subject_assessment_structure', ...Array(4).fill('mutate_my_subject_assessment_structure')]);
  assert.deepEqual(calls.slice(1).map(c => c[1].operation), ['create', 'edit', 'delete', 'weightage']);
  assert.ok(calls.every(c => c[1].target_offering === 'hub-anchor'));
  assert.equal(calls[2][1].target_assessment, 'original-assessment-id');
  assert.equal(calls[3][1].target_assessment, 'original-assessment-id');
  assert.equal(calls[4][1].total_weight, 70);
});
test('structure conflicts and protection errors propagate instead of faking a successful save', async () => {
  const error = { message: 'Existing assessment structures differ within this subject.' };
  const { api } = apiSetup(error);
  await assert.rejects(api.loadAssessmentStructure('hub'), e => e === error);
  await assert.rejects(api.saveOfferingWeightage('hub', 70), e => e === error);
  await assert.rejects(api.saveAssessment('hub', { name: 'Q', type: 'Quiz', maxMarks: 20, weightage: 10 }), e => e === error);
  await assert.rejects(api.deleteAssessment('hub', 'assessment'), e => e === error);
});
