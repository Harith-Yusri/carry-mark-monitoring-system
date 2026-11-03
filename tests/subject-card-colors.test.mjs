import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/features/lecturer/LecturerDashboard.tsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const subjectThemes'), source.indexOf('function formatSubjectSync'));
const { code } = await transform(helpers, { loader: 'ts' });
const assign = new Function(code + '; return assignSubjectThemes;')();

test('previously colliding subjects get distinct colors across semester groups', () => {
  const rows = ['ITT557', 'ITT588', 'ITT593', 'ITT569'].map(code => ({ code }));
  const colors = assign(rows);
  assert.equal(new Set([...colors.values()].map(theme => theme.accent)).size, rows.length);
  assert.deepEqual(assign([...rows].reverse()), colors);
  assert.deepEqual(assign([...rows, { code: ' itt557 ' }]), colors);
});

test('subjects beyond the eight-color palette receive distinct additional colors', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ code: `ITT${i}` }));
  const colors = assign(rows);
  assert.equal(colors.size, rows.length);
  assert.equal(new Set([...colors.values()].map(theme => theme.accent)).size, rows.length);
});
