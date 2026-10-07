import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingSections, reminderText } from './email.mjs';

test('only outstanding sections are included, including missing and reopened submissions', () => {
  const result = pendingSections([{ subjects: { code: 'CSC100', name: 'Computing' }, class_sections: [
    { label: 'A', submissions: [{ status: 'finalised' }] },
    { label: 'B', programmes: { code: 'CS251' }, submissions: [] },
    { label: 'C', programmes: { code: 'CS251' }, submissions: { status: 'reopened' } },
    { label: 'D', submissions: { status: 'finalised' } },
    { label: 'E', submissions: null },
  ] }]);
  assert.deepEqual(result, ['CSC100 (CS251) — Computing, Section B', 'CSC100 (CS251) — Computing, Section C', 'CSC100 (Programme not set) — Computing, Section E']);
});
test('no assignments or fully finalised assignments produce no reminder', () => {
  assert.deepEqual(pendingSections([]), []);
  assert.deepEqual(pendingSections([{ class_sections: [] }]), []);
  assert.deepEqual(pendingSections([{ class_sections: [{ submissions: [{ status: 'finalised' }] }] }]), []);
});
test('lecturer subject name overrides are used in reminders', () => {
  assert.deepEqual(pendingSections([{ subject_name_override: 'Advanced Computing', subjects: { code: 'CSC100', name: 'Computing' }, class_sections: [{ label: 'A', programmes: { code: 'CS251' }, submissions: [] }] }]), [
    'CSC100 (CS251) — Advanced Computing, Section A',
  ]);
});
test('email names the lecturer and outstanding class without including student marks', () => {
  const text = reminderText('Dr Rashidah Rosman', ['CSC100 — Computing, Section B']);
  assert.match(text, /Dear Dr Rashidah Rosman,/);
  assert.match(text, /CSC100 — Computing, Section B/);
  assert.match(text, /submit and finalise/);
});
