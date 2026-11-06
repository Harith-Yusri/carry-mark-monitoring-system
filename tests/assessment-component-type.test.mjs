import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';

// Run the form's real event handlers with only the API and hook boundaries stubbed.
const source = (await readFile('src/features/lecturer/AssessmentsTab.tsx', 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export function AssessmentsTab', 'function AssessmentsTab');
const { code } = await transform(source, { loader: 'tsx', jsx: 'transform' });
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
function setup(existingType) {
  const item = { id: 'assessment-1', name: 'Component', type: existingType, maxMarks: 20, weightage: 10 };
  const states = [60, '60', false, false, existingType === undefined ? [] : [item]];
  let cursor = 0;
  const saved = [];
  const useState = initial => {
    const i = cursor++;
    if (!(i in states)) states[i] = initial;
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  };
  const icon = () => null;
  const Component = new Function('React', 'useState', 'useEffect', 'useMemo', 'W', 'userError',
    'CheckCircle', 'Edit3', 'Plus', 'Trash2', 'X', 'listAssessments', 'loadOfferingWeightage',
    'saveOfferingWeightage', 'deleteAssessment', 'persistAssessment', 'loadAssessmentStructure', code + '; return AssessmentsTab;')(
    React, useState, () => {}, fn => fn(), {}, (_, fallback) => fallback,
    icon, icon, icon, icon, icon, async () => [], async () => ({}), async () => {}, async () => {},
    async (...args) => saved.push(args),
    async () => ({ assessments: [], carryMax: 60 }),
  );
  const render = () => { cursor = 0; return Component({ offeringId: 'offering-1', subjectCode: 'ITT593' }); };
  const field = id => nodes(render()).find(n => n.props?.id === id);
  const button = label => nodes(render()).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes(label));
  const change = (id, value) => field(id).props.onChange({ target: { value } });
  const openAdd = () => {
    button(' Add Assessment').props.onClick();
    change('component-name', ' Component ');
    change('component-max-score', '20');
    change('component-weightage', '10');
  };
  return { field, button, change, openAdd, saved };
}

test('dropdown has all requested options and saves predefined types', async () => {
  const ui = setup(); ui.openAdd();
  assert.equal(ui.field('component-type').type, 'select');
  assert.deepEqual(React.Children.toArray(ui.field('component-type').props.children).map(n => n.props.value),
    ['', 'Quiz', 'Assignment', 'Test', 'Project', 'Presentation', 'Lab', 'Practical', 'Case Study', 'Final Assessment', 'Other']);
  assert.equal(ui.button('Add Assessment').props.disabled, true);
  ui.change('component-type', 'Quiz');
  assert.equal(ui.field('custom-component-type'), undefined);
  await ui.button('Add Assessment').props.onClick();
  assert.deepEqual(ui.saved, [['offering-1', { name: 'Component', type: 'Quiz', maxMarks: 20, weightage: 10 }, undefined]]);
});

test('Other requires nonblank custom text, trims it and never saves the selector sentinel', async () => {
  const ui = setup(); ui.openAdd(); ui.change('component-type', 'Other');
  assert.equal(ui.field('custom-component-type').props.required, true);
  ui.change('custom-component-type', '   ');
  assert.equal(ui.button('Add Assessment').props.disabled, true);
  await ui.button('Add Assessment').props.onClick();
  assert.deepEqual(ui.saved, []);
  ui.change('custom-component-type', '  Studio Review  ');
  await ui.button('Add Assessment').props.onClick();
  assert.equal(ui.saved[0][1].type, 'Studio Review');
});

for (const existingType of ['Quiz', 'Studio Review', 'Other']) {
  test(`editing preserves existing type: ${existingType}`, async () => {
    const ui = setup(existingType); ui.button(' Edit').props.onClick();
    assert.equal(ui.field('component-type').props.value, existingType === 'Quiz' ? 'Quiz' : 'Other');
    if (existingType !== 'Quiz') assert.equal(ui.field('custom-component-type').props.value, existingType);
    await ui.button('Save Changes').props.onClick();
    assert.equal(ui.saved[0][1].type, existingType);
    assert.equal(ui.saved[0][2], 'assessment-1');
  });
}

test('switching from custom to predefined saves only the predefined value', async () => {
  const ui = setup('Studio Review'); ui.button(' Edit').props.onClick();
  ui.change('component-type', 'Test');
  assert.equal(ui.field('custom-component-type'), undefined);
  await ui.button('Save Changes').props.onClick();
  assert.equal(ui.saved[0][1].type, 'Test');
});
