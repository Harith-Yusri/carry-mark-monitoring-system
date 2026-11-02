import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = (await readFile(new URL('./index.ts', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const { code } = await transform(source, { loader: 'ts', format: 'cjs' });

function setup({ enabled = true, validCredentials = true, completeProfile = true } = {}) {
  let handler;
  const auth = {
    async signInWithPassword() {
      if (!validCredentials) return { error: new Error('Invalid credentials'), data: { session: null } };
      return { data: { session: { access_token: 'demo-access', refresh_token: 'demo-refresh' } } };
    },
  };
  const client = {
    auth,
    async rpc(name) {
      assert.equal(name, 'get_my_mobile_portal');
      return completeProfile ? { data: { student: { matrix_number: '20260001' } } } : { data: { student: null } };
    },
  };
  const createClient = () => client;
  const values = {
    DEMO_LOGIN_ENABLED: enabled ? 'true' : 'false',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'public-key',
    DEMO_STUDENT_EMAIL: 'demo@student.uitm.edu.my',
    DEMO_STUDENT_PASSWORD: 'demo-password',
  };
  const Deno = { env: { get: key => values[key] }, serve: value => { handler = value; } };
  new Function('createClient', 'Deno', code)(createClient, Deno);
  return handler;
}

test('disabled demo mode exposes no login session', async () => {
  const response = await setup({ enabled: false })(new Request('https://example.com', { method: 'POST' }));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).access_token, undefined);
});

test('enabled demo mode returns a real Supabase session for a complete student profile', async () => {
  const response = await setup()(new Request('https://example.com', { method: 'POST' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { access_token: 'demo-access', refresh_token: 'demo-refresh' });
});

test('invalid credentials or missing student profile never return tokens', async () => {
  for (const options of [{ validCredentials: false }, { completeProfile: false }]) {
    const response = await setup(options)(new Request('https://example.com', { method: 'POST' }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).access_token, undefined);
  }
});
