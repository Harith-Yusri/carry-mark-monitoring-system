import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'cjs' });

function setup() {
  let handler;
  const Deno = { serve: value => { handler = value; } };
  new Function('Deno', code)(Deno);
  return handler;
}

test('retired Student ID/password endpoint never returns authentication tokens', async () => {
  const handler = setup();
  const response = await handler(new Request('https://example.com', {
    method: 'POST',
    body: JSON.stringify({ studentId: '20260001', password: 'example-password' }),
  }));
  const body = await response.json();
  assert.equal(response.status, 410);
  assert.equal(body.code, 'student_password_login_retired');
  assert.equal(body.access_token, undefined);
  assert.equal(body.refresh_token, undefined);
});

test('retired endpoint retains CORS preflight support', async () => {
  const handler = setup();
  const response = await handler(new Request('https://example.com', { method: 'OPTIONS' }));
  assert.equal(response.status, 200);
});
