import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
const source = (await readFile(new URL('./index.ts', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const { code } = await transform(source, { loader: 'ts', format: 'cjs' });
function setup({ email = 'updated@example.com', passwordValid = true, active = true, linkedId = 'TS003' } = {}) {
  let handler;
  const calls = [];
  const admin = {
    async rpc(name, args) { assert.equal(name, 'resolve_staff_login_email'); assert.equal(args.target_staff_no, 'TS003'); return { data: email }; },
    from() { const query = { select() { return query; }, eq() { return query; }, async single() { return { data: { staff_no: linkedId, role: 'lecturer', is_active: active } }; } }; return query; },
  };
  const auth = { auth: { async signInWithPassword(credentials) { calls.push(credentials); return passwordValid ? { data: { user: { id: 'uuid' }, session: { access_token: 'access', refresh_token: 'refresh' } } } : { error: new Error('bad password') }; } } };
  const createClient = (_url, key) => key === 'service' ? admin : auth;
  const Deno = { env: { get: key => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'public' }, serve: value => { handler = value; } };
  new Function('createClient', 'Deno', code)(createClient, Deno);
  return { calls, request: () => handler(new Request('https://example.com', { method: 'POST', body: JSON.stringify({ staffNo: 'TS003', password: 'example-password' }) })) };
}
test('staff ID uses the current registered email and returns tokens only after password verification', async () => {
  const { calls, request } = setup();
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ email: 'updated@example.com', password: 'example-password' }]);
  assert.deepEqual(await response.json(), { access_token: 'access', refresh_token: 'refresh' });
});
test('unknown or throttled accounts never reach password verification', async () => {
  const { calls, request } = setup({ email: null });
  const response = await request();
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await response.json()).email, undefined);
});
test('incorrect passwords, inactive profiles and mismatched staff IDs never receive tokens', async () => {
  for (const options of [{ passwordValid: false }, { active: false }, { linkedId: 'TS999' }]) {
    const { request } = setup(options);
    const response = await request();
    assert.equal(response.status, 401);
    assert.equal((await response.json()).access_token, undefined);
  }
});
