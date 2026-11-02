import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Construct a new HAR from an allow-list. Never copy arbitrary HAR metadata,
// headers, URL queries/fragments, bodies, cookie values or browser session IDs.
export function sanitizeHar(input) {
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : -1;
  const endpoints = new Set([
    'get_admin_current_overview', 'get_admin_semester_history', 'get_my_lecturer_subject_dashboard',
    'get_my_lecturer_subjects', 'get_my_archived_lecturer_subjects', 'get_offering_student_totals',
    'get_academic_semester_summaries', 'profiles', 'programmes', 'academic_terms', 'subject_offerings',
    'subjects', 'class_sections', 'assessments', 'enrolments', 'marks', 'submissions',
    'programme_deadlines', 'notification_settings', 'notifications', 'staff-login', 'send-reminder',
  ]);
  const safeUrl = value => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return 'https://redacted.invalid/';
      // Keep only known endpoint names, never arbitrary path values or IDs.
      const parts = url.pathname.split('/').filter(Boolean);
      let path = '/[redacted-path]';
      const name = value => endpoints.has(value) ? value : '[redacted]';
      if (parts[0] === 'rest' && parts[1] === 'v1') {
        path = parts[2] === 'rpc' ? `/rest/v1/rpc/${name(parts[3])}` : `/rest/v1/${name(parts[2])}`;
      } else if (parts[0] === 'auth' && parts[1] === 'v1') {
        const allowed = ['user', 'token', 'authorize', 'callback', 'logout', 'settings', 'signup', 'resend', 'recover'];
        path = `/auth/v1/${allowed.includes(parts[2]) ? parts[2] : '[redacted]'}`;
      } else if (parts[0] === 'functions' && parts[1] === 'v1') {
        path = `/functions/v1/${name(parts[2])}`;
      } else if (parts[0] === 'assets' && /\.(js|css|woff2?|png|svg|ico)$/.test(parts[1] ?? '')
        && /^[a-zA-Z0-9_.-]{1,150}$/.test(parts[1])) {
        path = `/assets/${parts[1]}`;
      } else if (['/', '/admin/dashboard', '/lecturer/dashboard', '/login'].includes(url.pathname)) {
        path = url.pathname;
      }
      return `${url.origin}${path}`;
    } catch { return 'https://redacted.invalid/'; }
  };
  return { log: {
    version: '1.2', creator: { name: 'CAMS timing-only HAR sanitizer', version: '1' },
    entries: (input.log?.entries ?? []).map(entry => ({
      startedDateTime: Number.isFinite(Date.parse(entry.startedDateTime)) ? new Date(entry.startedDateTime).toISOString() : new Date(0).toISOString(),
      time: number(entry.time),
      request: {
        method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(entry.request?.method) ? entry.request.method : 'OTHER',
        url: safeUrl(entry.request?.url), httpVersion: '', cookies: [], headers: [], queryString: [],
        headersSize: number(entry.request?.headersSize), bodySize: number(entry.request?.bodySize),
      },
      response: {
        status: number(entry.response?.status), statusText: '', httpVersion: '', cookies: [], headers: [], redirectURL: '',
        headersSize: number(entry.response?.headersSize), bodySize: number(entry.response?.bodySize),
        content: { size: number(entry.response?.content?.size), mimeType: /^(application\/json|application\/javascript|text\/javascript|text\/css|text\/html)$/.test(entry.response?.content?.mimeType) ? entry.response.content.mimeType : '', compression: number(entry.response?.content?.compression) },
        _transferSize: number(entry.response?._transferSize),
      },
      timings: Object.fromEntries(['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'].map(key => [key, number(entry.timings?.[key])])),
      cache: {},
      _fromDiskCache: entry._fromDiskCache === true,
      _fromMemoryCache: entry._fromMemoryCache === true,
    })),
  } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , sourcePath, destinationPath] = process.argv;
  if (!sourcePath || !destinationPath) throw new Error('Usage: node scripts/sanitize-har.mjs INPUT.har OUTPUT.sanitized.har');
  let destinationRealPath;
  try { destinationRealPath = await realpath(destinationPath); } catch { destinationRealPath = resolve(destinationPath); }
  if (await realpath(sourcePath) === destinationRealPath) throw new Error('Use a different output file; keep the original private.');
  const clean = sanitizeHar(JSON.parse(await readFile(sourcePath, 'utf8')));
  await writeFile(destinationPath, JSON.stringify(clean, null, 2), { mode: 0o600 });
  console.log(`Wrote ${clean.log.entries.length} timing-only requests to ${destinationPath}. Headers, bodies, cookies, queries and custom metadata were removed.`);
}
