import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { pendingSections, reminderText } from './email.mjs';

// Run the production handler with mocked network boundaries. No emails are sent.
const source = (await readFile(new URL('./index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '');
const { code } = await transform(source, { loader: 'ts', format: 'cjs' });
function setup({ role = 'admin', active = true, email = 'lecturer@another-domain.edu', finalised = false, providerOk = true, from = 'Carry Mark System <noreply@verified-domain.com>', mode, testRecipient } = {}) {
  let handler;
  const calls = { lookups: [], emails: [] };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin-id' } }, error: null }) },
    from(table) {
      let selection;
      const query = {
        select(value) { selection = value; return query; },
        eq() { return query; },
        async single() { return { data: { role, is_active: active } }; },
        async maybeSingle() {
          assert.equal(selection, 'id,full_name');
          return { data: { id: 'lecturer-auth-id', full_name: 'Dr Rashidah Rosman' } };
        },
        async order() {
          assert.equal(table, 'subject_offerings');
          assert.match(selection, /academic_terms!inner\(is_current\)/);
          assert.doesNotMatch(selection, /subject_name_override,programmes/);
          return { data: [{ subjects: { code: 'CSC100', name: 'Computing' }, class_sections: [{ label: 'A', programmes: { code: 'CS251' }, submissions: finalised ? [{ status: 'finalised' }] : [] }] }] };
        },
      };
      return query;
    },
  };
  const createClient = (_url, key) => key === 'service-key' ? {
    auth: { admin: { async getUserById(id) { calls.lookups.push(id); return { data: { user: { email } } }; } } },
  } : db;
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service-key', RESEND_API_KEY: 'test', REMINDER_FROM_EMAIL: from, REMINDER_EMAIL_MODE: mode, REMINDER_TEST_RECIPIENT: testRecipient };
  const Deno = { env: { get: key => env[key] }, serve: value => { handler = value; } };
  const fetch = async (_url, options) => {
    calls.emails.push(JSON.parse(options.body));
    return Response.json(providerOk ? { id: 'email-id' } : { name: 'validation_error' }, { status: providerOk ? 200 : 403 });
  };
  new Function('createClient', 'pendingSections', 'reminderText', 'Deno', 'fetch', code)(createClient, pendingSections, reminderText, Deno, fetch);
  const request = (authenticated = true) => handler(new Request('https://example.com', {
    method: 'POST', headers: authenticated ? { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' } : {},
    body: JSON.stringify({ staffNo: 'TS003', email: 'untrusted@example.com' }),
  }));
  return { calls, request };
}

test('recipient comes from the linked Auth account, ignoring any supplied email', async () => {
  const { calls, request } = setup();
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(calls.lookups, ['lecturer-auth-id']);
  assert.deepEqual(calls.emails[0].to, ['lecturer@another-domain.edu']);
  assert.equal(calls.emails[0].from, 'Carry Mark System <noreply@verified-domain.com>');
  assert.equal((await response.json()).recipient, 'lecturer@another-domain.edu');
});
test('unauthenticated, lecturer and inactive admin callers cannot access Auth emails or send', async () => {
  for (const options of [{}, { role: 'lecturer' }, { active: false }]) {
    const { calls, request } = setup(options);
    const response = await request(Object.keys(options).length > 0);
    assert.ok([401, 403].includes(response.status));
    assert.equal(calls.lookups.length, 0);
    assert.equal(calls.emails.length, 0);
  }
});
test('missing registered email or completed submissions do not send', async () => {
  for (const [options, status] of [[{ email: null }, 422], [{ finalised: true }, 409]]) {
    const { calls, request } = setup(options);
    assert.equal((await request()).status, status);
    assert.equal(calls.emails.length, 0);
  }
});
test('provider rejection is reported as failure', async () => {
  const { request } = setup({ providerOk: false });
  const response = await request();
  assert.equal(response.status, 502);
  assert.equal((await response.json()).accepted, undefined);
});
test('production mode rejects the Resend test sender before attempting delivery', async () => {
  const { calls, request } = setup({ from: 'Carry Mark System <onboarding@resend.dev>' });
  const response = await request();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /In production/);
  assert.equal(calls.emails.length, 0);
});
test('development mode permits the Resend test sender for the configured recipient', async () => {
  const { calls, request } = setup({
    mode: 'development',
    from: 'Carry Mark System <onboarding@resend.dev>',
    email: 'test-owner@example.com',
    testRecipient: 'TEST-OWNER@example.com',
  });
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(calls.emails[0].to, ['test-owner@example.com']);
});
test('development mode rejects every recipient except the configured test recipient', async () => {
  const { calls, request } = setup({
    mode: 'development',
    from: 'onboarding@resend.dev',
    email: 'lecturer@example.edu',
    testRecipient: 'test-owner@example.com',
  });
  const response = await request();
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /configured test recipient/);
  assert.equal(calls.emails.length, 0);
});
test('development mode requires a valid configured test recipient', async () => {
  const { calls, request } = setup({ mode: 'development', from: 'onboarding@resend.dev' });
  const response = await request();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /REMINDER_TEST_RECIPIENT/);
  assert.equal(calls.emails.length, 0);
});
test('an invalid email mode fails closed', async () => {
  const { calls, request } = setup({ mode: 'staging' });
  const response = await request();
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /REMINDER_EMAIL_MODE/);
  assert.equal(calls.emails.length, 0);
});
