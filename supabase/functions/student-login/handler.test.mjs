import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = (await readFile(new URL('./index.ts', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
const { code } = await transform(source, { loader: 'ts', format: 'cjs' });

function setup({ email = 'student@example.com', passwordValid = true, verificationRequired = false, active = true, linkedId = '20260001' } = {}) {
  let handler;
  const calls = [];
  const admin = {
    async rpc(name, args) {
      assert.equal(name, 'resolve_student_login_email');
      assert.equal(args.target_matrix_no, '20260001');
      return { data: email };
    },
    from() {
      const query = {
        select() { return query; },
        eq() { return query; },
        async single() { return { data: { matrix_no: linkedId, is_active: active } }; },
      };
      return query;
    },
  };
  const auth = {
    auth: {
      async signInWithPassword(credentials) {
        calls.push(credentials);
        if (verificationRequired) return { error: { code: 'email_not_confirmed', message: 'Email not confirmed' } };
        return passwordValid
          ? { data: { user: { id: 'uuid' }, session: { access_token: 'access', refresh_token: 'refresh' } } }
          : { error: new Error('bad password') };
      },
    },
  };
  const createClient = (_url, key) => key === 'service' ? admin : auth;
  const Deno = { env: { get: key => key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : 'public' }, serve: value => { handler = value; } };
  new Function('createClient', 'Deno', code)(createClient, Deno);
  return {
    calls,
    request: () => handler(new Request('https://example.com', {
      method: 'POST',
      body: JSON.stringify({ studentId: '20260001', password: 'example-password' }),
    })),
  };
}

test('Student ID resolves registered email and returns tokens after password verification', async () => {
  const { calls, request } = setup();
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ email: 'student@example.com', password: 'example-password' }]);
  assert.deepEqual(await response.json(), { access_token: 'access', refresh_token: 'refresh' });
});

test('unknown, inactive, invalid-password and mismatched student accounts receive no tokens', async () => {
  for (const options of [{ email: null }, { passwordValid: false }, { active: false }, { linkedId: '20269999' }]) {
    const { request } = setup(options);
    const response = await request();
    assert.equal(response.status, 401);
    assert.equal((await response.json()).access_token, undefined);
  }
});

test('unconfirmed student receives a verification message without tokens', async () => {
  const { request } = setup({ verificationRequired: true, active: false });
  const response = await request();
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'email_not_confirmed');
});
