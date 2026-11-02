import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHar } from '../scripts/sanitize-har.mjs';

test('HAR sanitizer removes secrets in headers, cookies, bodies, URLs and custom metadata', () => {
  const secret = 'PRIVATE_SENTINEL';
  const clean = sanitizeHar({log:{pages:[{title:secret}],entries:[{
    startedDateTime:'2026-11-02T00:00:00Z', time:123,
    request:{method:'POST',url:`https://username:${secret}@example.supabase.co/rest/v1/rpc/get_admin_current_overview?apikey=${secret}#${secret}`,headers:[{name:'Authorization',value:secret}],cookies:[{name:'session',value:secret}],postData:{text:secret}},
    response:{status:200,headers:[{name:'Set-Cookie',value:secret}],content:{text:secret,size:456},redirectURL:secret},
    timings:{wait:99,receive:12},_initiator:{stack:secret},_securityDetails:{secret},
  }]}});
  assert.ok(!JSON.stringify(clean).includes(secret));
  assert.equal(clean.log.entries[0].request.url,'https://example.supabase.co/rest/v1/rpc/get_admin_current_overview');
  assert.equal(clean.log.entries[0].time,123);assert.equal(clean.log.entries[0].timings.wait,99);assert.equal(clean.log.entries[0].response.content.size,456);
});

test('HAR sanitizer drops unknown endpoint paths and non-HTTP URLs', () => {
  for(const url of ['cmms://auth/callback#access_token=PRIVATE','https://example.test/private/PRIVATE','https://example.test/rest/v1/rpc/PRIVATE','https://example.test/functions/v1/PRIVATE']) {
    const clean=sanitizeHar({log:{entries:[{request:{url}}]}});
    assert.ok(!JSON.stringify(clean).includes('PRIVATE'));
  }
});
