import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = (await readFile('src/features/lecturer/AssessmentsTab.tsx', 'utf8'))
  .replace(/^import .*;\n/gm, '').replaceAll('import.meta.env.DEV', 'false').replace('export function AssessmentsTab', 'function AssessmentsTab');
const { code } = await transform(source, { loader: 'tsx', jsx: 'transform' });
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]; }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function setup({ saveGate, refreshGate, failRefresh = false, failSave = false, loseResponse = false } = {}) {
  const states = [60, '60', false, false, []];
  const saveRef = { current: false };
  const calls = []; let refreshes = 0; let cursor = 0; let records = []; let serial = 0;
  const useState = initial => {
    const i = cursor++; if (!(i in states)) states[i] = initial;
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  };
  const icon = () => null;
  const Component = new Function('React', 'useState', 'useRef', 'useEffect', 'useMemo', 'W', 'userError',
    'CheckCircle', 'Edit3', 'Plus', 'Trash2', 'X', 'loadAssessmentStructure', 'saveOfferingWeightage', 'deleteAssessment', 'persistAssessment', code + ';return AssessmentsTab;')(
    React, useState, () => saveRef, () => {}, fn => fn(), {}, (_, fallback) => fallback,
    icon, icon, icon, icon, icon,
    async () => {
      refreshes++;
      if (refreshGate) await refreshGate.promise;
      if (failRefresh) throw { code: 'PGRST000', status: 503 };
      return { assessments: records.map(r => ({ ...r })), carryMax: 60 };
    }, async () => {}, async () => {},
    async (offering, values, id) => {
      calls.push({ offering, values, id });
      if (saveGate) await saveGate.promise;
      if (failSave) throw { code: '23505' };
      if (id) records = records.map(r => r.id === id ? { ...r, ...values } : r);
      else records.push({ ...values, id: `saved-${++serial}`, position: records.length + 1 });
      if (loseResponse) throw { code: '', message: 'TypeError: Failed to fetch' };
      // Production RPC returns void; the UI must not invent assessment IDs.
    },
  );
  const render = () => { cursor = 0; return Component({ offeringId: 'hub-anchor', subjectCode: 'ITT550' }); };
  const button = label => nodes(render()).find(n => n.type === 'button' && React.Children.toArray(n.props.children).includes(label));
  const change = (id, value) => nodes(render()).find(n => n.props?.id === id).props.onChange({ target: { value } });
  const open = (name = 'Quiz One') => {
    button(' Add Assessment').props.onClick();
    change('component-name', name); change('component-type', 'Quiz'); change('component-max-score', '20'); change('component-weightage', '10');
  };
  return { render, button, change, open, calls, get refreshes() { return refreshes; }, get records() { return records; },
    html: () => renderToStaticMarkup(render()), setRefreshFailure: value => { failRefresh = value; }, setSaveFailure: value => { failSave = value; } };
}

test('normal creation closes and resets the form, refreshes the real list and reports success', async () => {
  const ui = setup(); ui.open(); await ui.button('Add Assessment').props.onClick();
  assert.equal(ui.calls.length, 1); assert.equal(ui.refreshes, 1);
  assert.match(ui.html(), /Assessment saved\./); assert.match(ui.html(), /Quiz One/);
  assert.doesNotMatch(ui.html(), /role="dialog"|Unable to save assessment/);
  assert.equal(ui.button(' Add Assessment').props.disabled, false);
});

test('rapid clicks and a slow mutation send one request even before React re-renders', async () => {
  const gate = deferred(); const ui = setup({ saveGate: gate }); ui.open();
  const handler = ui.button('Add Assessment').props.onClick;
  const first = handler(); const second = handler();
  assert.equal(ui.calls.length, 1); assert.equal(ui.button('Saving…').props.disabled, true);
  assert.equal(nodes(ui.render()).find(n => n.type === 'fieldset').props.disabled, true);
  // Backdrop/close handlers cannot discard a pending form and start another save.
  nodes(ui.render()).find(n => n.props?.['aria-label'] === 'Close').props.onClick();
  assert.match(ui.html(), /role="dialog"/);
  gate.resolve(); await Promise.all([first, second]);
  assert.equal(ui.records.length, 1); assert.doesNotMatch(ui.html(), /Unable to save assessment|Saving…/);
});

test('confirmed save plus refresh failure stays successful and retry only reads, never inserts', async () => {
  const ui = setup({ failRefresh: true }); ui.open(); await ui.button('Add Assessment').props.onClick();
  assert.equal(ui.records.length, 1); assert.equal(ui.calls.length, 1);
  assert.match(ui.html(), /Assessment saved, but the latest data could not be refreshed/);
  assert.doesNotMatch(ui.html(), /Unable to save assessment|role="dialog"/);
  assert.equal(ui.button(' Add Assessment').props.disabled, true);
  await ui.button('Refresh assessments').props.onClick();
  assert.equal(ui.calls.length, 1); assert.equal(ui.button('Refresh assessments').props.disabled, false);
  ui.setRefreshFailure(false); await ui.button('Refresh assessments').props.onClick();
  assert.equal(ui.calls.length, 1); assert.match(ui.html(), /Quiz One/);
  assert.doesNotMatch(ui.html(), /could not be refreshed/);
  assert.equal(ui.button(' Add Assessment').props.disabled, false);
});

test('slow post-save refresh keeps the committed result successful and blocks new mutations until ready', async () => {
  const gate = deferred(); const ui = setup({ refreshGate: gate }); ui.open();
  const pending = ui.button('Add Assessment').props.onClick();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(ui.records.length, 1); assert.match(ui.html(), /Assessment saved\./);
  assert.doesNotMatch(ui.html(), /role="dialog"|Unable to save assessment/);
  assert.equal(ui.button(' Add Assessment').props.disabled, true);
  gate.resolve(); await pending;
  assert.equal(ui.button(' Add Assessment').props.disabled, false);
});

test('actual mutation rejection preserves the form, skips refresh and always re-enables Save', async () => {
  const ui = setup({ failSave: true }); ui.open(); await ui.button('Add Assessment').props.onClick();
  assert.equal(ui.refreshes, 0); assert.equal(ui.records.length, 0);
  assert.match(ui.html(), /Unable to save assessment\./);
  assert.match(ui.html(), /role="dialog"/);
  assert.equal(ui.button('Add Assessment').props.disabled, false);
  ui.setSaveFailure(false); await ui.button('Add Assessment').props.onClick();
  assert.equal(ui.records.length, 1); assert.doesNotMatch(ui.html(), /Unable to save assessment/);
});

test('multiple different creates and a later edit retain accurate IDs and list values', async () => {
  const ui = setup(); ui.open('Quiz One'); await ui.button('Add Assessment').props.onClick();
  ui.open('Quiz Two'); await ui.button('Add Assessment').props.onClick();
  assert.equal(ui.records.length, 2);
  ui.button(' Edit').props.onClick(); ui.change('component-name', 'Updated Quiz One');
  await ui.button('Save Changes').props.onClick();
  assert.equal(ui.records.length, 2); assert.equal(ui.calls[2].id, 'saved-1');
  assert.match(ui.html(), /Updated Quiz One/); assert.match(ui.html(), /Quiz Two/);
});

test('a lost response after a server commit is uncertain, never called a failed save or automatically retried', async () => {
  const ui = setup({ loseResponse: true }); ui.open(); await ui.button('Add Assessment').props.onClick();
  assert.equal(ui.records.length, 1); assert.equal(ui.calls.length, 1);
  assert.match(ui.html(), /save result could not be confirmed/);
  assert.doesNotMatch(ui.html(), /Unable to save assessment|Assessment saved\./);
  assert.equal(ui.button(' Add Assessment').props.disabled, true);
  ui.setRefreshFailure(true); await ui.button('Refresh assessments').props.onClick();
  assert.match(ui.html(), /save result is still unconfirmed/);
  assert.doesNotMatch(ui.html(), /Assessment saved/);
  ui.setRefreshFailure(false); await ui.button('Refresh assessments').props.onClick();
  assert.match(ui.html(), /Quiz One/);
  assert.equal(ui.calls.length, 1); assert.equal(ui.records.length, 1);
  assert.equal(ui.button(' Add Assessment').props.disabled, false);
});
