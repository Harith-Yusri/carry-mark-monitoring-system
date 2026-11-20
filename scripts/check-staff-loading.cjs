// Browser regression checks use synthetic responses only. No Supabase request is sent.
// CAMS_PLAYWRIGHT_MODULE=/path/to/playwright CAMS_BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-staff-loading.cjs
const { chromium } = require(process.env.CAMS_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.CAMS_LOADING_BASE_URL || 'http://127.0.0.1:4178';
if (!['localhost', '127.0.0.1', 'unicams.online'].includes(new URL(base).hostname)) throw Error('Only local builds or the existing CAMS domain may be checked.');
const out = process.env.CAMS_LOADING_OUTPUT || '/tmp/cams-staff-loading-checks';
fs.mkdirSync(out, { recursive: true });
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const programme = { id: uid(20), code: 'CS240', name: 'Fixture Programme' };
const term = { id: uid(30), academic_year: '2026/2027', semester_no: 1, semester_code: '20271', starts_on: '2026-09-01', ends_on: '2027-02-01', default_deadline: '2027-01-01T00:00:00Z' };
const offering = uid(100);
const assessments = [{ id: uid(1000), name: 'Fixture Quiz', assessment_type: 'Quiz', max_score: 100, carry_weight: 50, position: 1 }];
const sections = ['A', 'B'].map((label, i) => ({ id: uid(200 + i), offering_id: offering, programme_id: programme.id, label: 'Class ' + label, capacity: 20, join_code: 'FIXTURE-CODE', programmes: programme, enrolments: [{ count: i ? 0 : 1 }], submissions: [] }));
const enrolments = [{ id: uid(300), section_id: sections[0].id, student_id: uid(400), students: { matrix_no: 'FIXTURE1', full_name: 'Fixture Student' } }];
const subject = { offering_id: offering, programme_ids: [programme.id], programme_codes: [programme.code], programme_names: [programme.name], subject_code: 'ITT550', subject_name: 'Fixture Subject', semester_code:term.semester_code, programme_semester: 5, student_count: 1, offering_status: 'active', updated_at: '2026-11-01T00:00:00Z', academic_year: term.academic_year, semester_no: term.semester_no };
const snapshot = { student_name: 'Fixture Student', student_number: 'FIXTURE1', subject_code: 'ITT550', subject_name: 'Fixture Subject', class_label: 'Class A', assessment_name: 'Fixture Quiz', lecturer_name: 'Fixture Lecturer', academic_year: term.academic_year, semester_code: term.semester_code };
const correction = { id: uid(500), dispute_id: uid(501), status: 'pending', reason: 'Fixture review', original_score: 50, maximum_score: 100, corrected_score: null, requested_at: '2026-11-08T01:00:00Z', decision_note: null, snapshot, events: [], editable: true };
const issue = { id: uid(501), status: 'reviewing', explanation: 'Please review fixture', response: null, created_at: '2026-11-08T01:00:00Z', student_name: 'Fixture Student', student_number: 'FIXTURE1', assessment_name: 'Fixture Quiz', class_label: 'Class A', current_score: 50, maximum_score: 100, can_correct: true, editable: true, released: true, corrections: [correction] };
const history = { ...term, id: uid(31), academic_year: '2025/2026', semester_no: 2, semester_code: '20262', status: 'closed', is_current: false, offering_count: 1, class_count: 2, enrolment_count: 1, mark_count: 1, submission_count: 1, finalised_count: 1 };
const outcomes = [];

async function start(browser, role, mode, dark, held = true, calendar = term) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const control = { calendar, held, pending: [], mode, notifications: [{ id: uid(600), title: 'New student mark issue', body: 'Fixture report', read_at: null, created_at: issue.created_at,
    data: { studentName: 'Fixture Student', subjectCode: 'ITT550', classLabel: 'Class A', assessmentName: 'Fixture Quiz', submittedAt: issue.created_at } }], issue: structuredClone(issue), score: 50, failures: new Set(), calls: [], results: [] };
  control.release = () => { control.held = false; control.pending.splice(0).forEach(resolve => resolve()); };
  // Terminate every test WebSocket locally; fixture JWTs never reach Realtime.
  await page.routeWebSocket('wss://*.supabase.co/**', socket => {
    let joined;
    socket.onMessage(raw => {
      const message = JSON.parse(String(raw));
      const [joinRef, ref, topic, event, payload] = message;
      if (event === 'phx_join') {
        const filters = (payload.config?.postgres_changes || []).map((filter, i) => ({ ...filter, id: i + 1 }));
        joined = {joinRef, topic, filters};
        socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', {status:'ok',response:{postgres_changes:filters}}]));
        control.emitNotification = record => {
          const filter = joined.filters.find(filter => filter.event === 'INSERT');
          socket.send(JSON.stringify([joined.joinRef, null, joined.topic, 'postgres_changes', {ids:[filter.id],data:{schema:'public',table:'notifications',type:'INSERT',commit_timestamp:new Date().toISOString(),columns:[],record:{...record,type:'mark_issue_submitted'},old_record:{}}}]));
        };
      } else if (event === 'heartbeat' || event === 'phx_leave') socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]));
    });
  });
  const user = { id: uid(role === 'admin' ? 1 : 2), aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {} };
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), Buffer.from('fixture-only').toString('base64url')].join('.');
  await context.addInitScript(({ user, token }) => {
    sessionStorage.setItem('sb-cueiilftoyqzvlrnmgfe-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture-only', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user }));
  }, { user, token });
  await page.route('https://*.supabase.co/**', async route => {
    const started = performance.now();
    const delay = Number(process.env.CAMS_FIXTURE_LATENCY_MS || 0);
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const url = new URL(route.request().url()); const name = url.pathname.split('/').pop();
    control.calls.push(name);
    let data;
    const empty = control.mode === 'empty';
    if (name === 'user') data = user;
    else if (name === 'profiles') data = { id: user.id, staff_no: 'STAFF-FIXTURE', full_name: 'Fixture ' + role, role, is_active: true };
    else {
      if (control.held) await new Promise(resolve => control.pending.push(resolve));
      if (control.mode === 'failure' || control.failures.has(name)) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'FIXTURE_ERROR', message: 'Fixture request failed' }) });
      if (name === 'get_admin_current_overview') data = { term, programmes: empty ? [] : [programme], lecturers: empty ? [] : [{ auth_id: uid(2), staff_no: 'LECT-FIXTURE', full_name: 'Fixture Lecturer', allocations: sections.map(s => ({ offering_id: offering, offering_status: 'active', offering_updated_at: '2026-11-01T00:00:00Z', subject_code: 'ITT550', subject_name: 'Fixture Subject', section_id: s.id, class_label: s.label, programme_id: programme.id, programme_code: programme.code, programme_name: programme.name, section_updated_at: '2026-11-01T00:00:00Z', student_count: 1, deadline_at: term.default_deadline, submission_status: 'draft', submission_updated_at: null })) }] };
      else if (name === 'get_my_lecturer_notifications') data = { items: empty ? [] : control.notifications, unread_count: empty ? 0 : control.notifications.filter(n=>!n.read_at).length, has_more: false };
      else if (name === 'open_my_mark_issue_notification') {
        const item = control.notifications.find(n=>n.id===route.request().postDataJSON().target_notification);
        if (!item) return route.fulfill({ status:400, contentType:'application/json',body:JSON.stringify({message:'CAMS: This notification is not available to your account.'}) });
        item.read_at ||= new Date().toISOString();
        data = {notification_id:item.id,read_at:item.read_at,unread_count:control.notifications.filter(n=>!n.read_at).length,issue_id:control.issue.id,subject_rows:[subject]};
      }
      else if (name === 'get_released_mark_correction_context' || name === 'stage_released_mark_correction') {
        const args=route.request().postDataJSON();
        assert.equal(args.target_section,uid(200));assert.equal(args.target_enrolment,uid(300));assert.equal(args.target_assessment,uid(1000));
        if(name==='stage_released_mark_correction') {
          assert.equal(args.expected_version,1);
          control.directDraft={...correction,id:uid(700),dispute_id:null,initiation_source:'lecturer',status:'corrected',reason:args.correction_reason,
            original_score:control.score,corrected_score:args.new_score,corrected_at:new Date().toISOString()};
          control.directHistory=[control.directDraft];
        }
        data={section_id:uid(200),enrolment_id:uid(300),assessment_id:uid(1000),mark_id:uid(800),version:control.directHistory?.[0]?.status==='released'?2:1,
          current_score:control.score,maximum_score:100,student_name:'Fixture Student',student_number:'FIXTURE1',subject_code:'ITT550',class_label:'Class A',assessment_name:'Fixture Quiz',
          correction:control.directDraft||null,history:control.directHistory||[]};
      }
      else if (name === 'get_staff_mark_issues') data = empty ? [] : [control.issue];
      else if (name === 'stage_mark_issue_correction') {
        const args = route.request().postDataJSON();
        assert.equal(args.target_issue, control.issue.id);
        control.issue.corrections = [{ ...correction, status: 'corrected', corrected_score: args.new_score, reason: args.correction_reason }]; data = correction.id;
      }
      else if (name === 'respond_to_mark_issue') {
        const args = route.request().postDataJSON();
        assert.equal(args.target_issue, control.issue.id); assert.equal(args.decision, 'rejected');
        Object.assign(control.issue, {status:'rejected',response:args.lecturer_response}); data = null;
      }
      else if (name === 'release_corrected_mark') {
        if(route.request().postDataJSON().target_request===uid(700)) {
          control.score=control.directDraft.corrected_score;control.directDraft.status='released';control.directDraft.released_at=new Date().toISOString();
          control.directDraft=null;data=null;
        } else {
        assert.equal(route.request().postDataJSON().target_request, correction.id);
        const draft = control.issue.corrections[0]; draft.status='released';
        Object.assign(control.issue,{status:'resolved',response:draft.reason,current_score:draft.corrected_score}); data = null;
        }
      }
      else if (name === 'lecturer_contacts') data = [];
      else if (name === 'get_admin_semester_history') data = empty ? [] : [history];
      else if (name === 'get_academic_semester_summaries') data = [{ ...history, ...term, is_current: true, status: 'active' }];
      else if (name === 'get_my_lecturer_subject_dashboard') data = { term: control.calendar, current: empty ? [] : [{...subject,academic_year:control.calendar.academic_year,semester_no:control.calendar.semester_no,semester_code:control.calendar.semester_code}], archived: [] };
      else if (name === 'get_my_subject_assessment_structure') data = { carryMax: empty ? null : 50, assessments: empty ? [] : assessments.map(a => ({ id: a.id, name: a.name, type: a.assessment_type, maxMarks: a.max_score, weightage: a.carry_weight, position: a.position })) };
      else if (name === 'get_staff_class_detail') {
        const section = sections.find(s => s.id === route.request().postDataJSON().target_section) || sections[0];
        data = { settings: { carryMax: 50, eligibleThreshold: 40 }, data: { assessments: assessments.map(a => ({ id: a.id, name: a.name, type: a.assessment_type, maxMarks: a.max_score, weightage: a.carry_weight, position: a.position })), sections: [{ id: section.id, programmeId: programme.id, programmeCode: programme.code, programmeName: programme.name, label: section.label, capacity: section.capacity, joinCode: section.join_code, finalised: Boolean(control.released && section.id===uid(200)), students: empty ? [] : [{ enrolmentId: uid(300), studentId: uid(400), matrixNo: 'FIXTURE1', name: 'Fixture Student', scores: { [uid(1000)]: control.score }, totalCarry: control.score/2, eligible: control.score/2>=40 }] }] } };
      }
      else if (name === 'class_sections') data = empty ? [] : sections.map(s=>({...s,submissions:control.released&&s.id===uid(200)?[{status:'finalised'}]:[]}));
      else if (name === 'assessments') data = empty ? [] : assessments;
      else if (name === 'subject_offerings') data = { carry_max: 50, academic_terms: { eligible_threshold: 40 } };
      else if (name === 'enrolments') data = empty ? [] : enrolments;
      else if (name === 'submissions') data = [];
      else if (name === 'marks' && route.request().method() === 'POST') { control.score = route.request().postDataJSON()[0].score; data = null; }
      else if (name === 'marks') data = empty ? [] : [{ enrolment_id: uid(300), assessment_id: uid(1000), score: 50, enrolments: { section_id: uid(200), status: 'enrolled' } }];
      else if (name === 'get_offering_student_totals') data = empty ? [] : [{ enrolment_id: uid(300), total_carry: 25, eligible: false }];
      else if (name === 'programmes') data = empty ? [] : [programme];
      else if (name === 'academic_terms') data = term;
      else if (name === 'programme_deadlines') data = [];
      else if (name === 'notification_settings') data = { auto_remind: false, reminder_days: null };
      else if (name === 'subjects') data = [{ code: 'ITT550', name: 'Fixture Subject', is_active: true }];
      else { errors.push('Unexpected Supabase request: ' + name); return route.abort(); }
    }
    const response = JSON.stringify(data);
    control.results.push({name, bytes:Buffer.byteLength(response), ms:performance.now()-started});
    return route.fulfill({ status: 200, contentType: 'application/json', body: response });
  });
  await page.goto(base + '/' + role + '/dashboard');
  await page.getByRole('heading', { name: role === 'admin' ? 'Academic Operations' : 'My Subjects', exact: true }).waitFor();
  if (dark) { await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click(); await page.locator('.staff-portal.dark').waitFor(); }
  return { context, page, control, errors };
}
const body = page => page.locator('body').innerText();
async function loading(page, forbidden) {
  await page.locator('.staff-loading[aria-busy="true"]').first().waitFor();
  const text = await body(page); for (const pattern of forbidden) assert.doesNotMatch(text, pattern);
}
async function adminScenario(browser, mode, dark, held) {
  const s = await start(browser, 'admin', mode, dark, held); const { page, control } = s;
  const tabs = [['Submission Monitor', 'Submission Monitor'], ['Lecturer Directory', 'Lecturer Directory'], ['Reports & Exports', 'Reports & Exports'], ['Past Academic Terms', 'Past Academic Terms'], ['System Settings', 'System Settings']];
  if (held) {
    await loading(page, [/All lecturer submissions are released/, /0 Open/, /0 lecturer records/]);
    await page.screenshot({ path: path.join(out, `admin-${dark ? 'dark' : 'light'}-loading.png`) });
    for (const [nav, heading] of tabs) {
      await page.getByRole('button', { name: new RegExp(nav) }).first().click();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await loading(page, [/No submissions match/, /0 of 0 Records/, /No archived academic terms/, /No mark correction requests/, /0 lecturers/]);
    }
    control.release();
  }
  for (const [nav, heading] of [['Compliance Overview', 'Academic Operations'], ...tabs]) {
    await page.getByRole('button', { name: new RegExp(nav) }).first().click();
    await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    await page.locator('.staff-loading').waitFor({ state: 'detached' });
    if (mode === 'failure') {
      await page.getByRole('alert').first().waitFor();
      assert.doesNotMatch(await body(page), /All lecturer submissions are released|No submissions match|No archived academic terms|No mark correction requests/);
    }
  }
  assert.equal(await page.getByRole('button', { name: /Mark Corrections/ }).count(), 0);
  assert.equal(control.calls.some(name => /mark_correction_(queue|pending_count)/.test(name)), false);
  assert.deepEqual(s.errors, []); outcomes.push({ role: 'admin', mode, dark, held, passed: true }); await s.context.close();
}
async function lecturerScenario(browser, mode, dark, held) {
  const s = await start(browser, 'lecturer', mode, dark, held); const { page, control } = s;
  if (held) { await loading(page, [/0 assignments|No Teaching Allocations/]); control.release(); }
  await page.locator('.staff-loading').waitFor({ state: 'detached' });
  if (mode === 'empty' || mode === 'failure') {
    if (mode === 'empty') await page.getByRole('heading', { name: 'No Teaching Allocations' }).waitFor();
    else { await page.getByRole('alert').first().waitFor(); assert.doesNotMatch(await body(page), /No Teaching Allocations|0 assignments/); }
    assert.deepEqual(s.errors, []); outcomes.push({ role: 'lecturer', mode, dark, held, passed: true }); return s.context.close();
  }
  control.held = held;
  await page.getByRole('button', { name: /Manage Subject Hub/ }).first().click();
  await page.getByRole('heading', { name: 'Continuous Assessment Components', exact: true }).waitFor();
  if (held) { await loading(page, [/No assessment components|0% \/|Not set/]); control.release(); }
  await page.getByText('Fixture Quiz', { exact: true }).waitFor();
  // Switching tabs while their requests are pending never exposes an empty selector.
  control.held = held;
  await page.getByRole('button', { name: /Marks Entry & Eligibility/ }).click();
  await page.getByRole('heading', { name: 'Select a Class', exact: true }).waitFor();
  if (held) {
    await loading(page, [/has 0 class|No class sections yet/]);
    await page.screenshot({ path: path.join(out, `marks-${dark ? 'dark' : 'light'}-loading.png`) });
    await page.getByRole('button', { name: /Export Carry Marks/ }).click();
    await page.getByRole('heading', { name: 'Select a Class to Export', exact: true }).waitFor();
    await loading(page, [/No class sections.*export/]); control.release();
    await page.getByRole('button', { name: /Open e-Res Preview/ }).first().waitFor();
    await page.getByRole('button', { name: /Marks Entry & Eligibility/ }).click();
  }
  await page.getByRole('button', { name: 'Enter marks for Class A', exact: true }).waitFor();
  assert.match(await body(page), /has 2 class sections/);
  // Remotely loaded programme options state is explicit, including background refetch.
  control.held = held;
  await page.getByRole('button', { name: 'Add Class Section', exact: true }).click();
  if (held) { assert.equal(await page.getByRole('combobox', { name: 'Programme', exact: true }).isDisabled(), true); assert.match(await body(page), /Loading programmes/); control.release(); }
  await page.getByRole('combobox', { name: 'Programme', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('#class-programme').disabled);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  control.held = held;
  await page.getByRole('button', { name: 'Enter marks for Class A', exact: true }).click();
  if (held) { await loading(page, [/This class has no student roster/]); control.release(); }
  await page.getByRole('heading', { name: 'Mark Entry — Class A', exact: true }).waitFor();
  await page.getByText('Fixture Student', { exact: true }).waitFor();
  control.held = true;
  await page.getByRole('button', { name: 'Sync Draft', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Refreshing class data' }).waitFor();
  assert.match(await body(page), /Fixture Student/); assert.doesNotMatch(await body(page), /This class has no student roster/); control.release();
  await page.getByRole('button', { name: 'Draft Synced', exact: true }).waitFor();
  // Optimisation regression: queued edits settle before a cached Export read.
  await page.getByRole('spinbutton', { name: 'Fixture Quiz mark for Fixture Student', exact: true }).fill('76');
  await page.getByRole('button', { name: /Export Carry Marks/ }).click();
  await page.getByRole('button', { name: /Open e-Res Preview/ }).first().click();
  await page.getByRole('heading', { name: 'e-Res Export', exact: true }).waitFor();
  assert.match(await body(page), /76/);
  control.held = held;
  await page.getByRole('button', { name: /Mark Issues/ }).click();
  await page.getByRole('heading', { name: 'Mark Issues', exact: true }).waitFor();
  if (held) { await loading(page, [/No mark issues have been reported/]); control.release(); }
  await page.getByText('Please review fixture', { exact: true }).waitFor();
  // A legacy pending request can be corrected directly; it cannot be released before staging.
  assert.equal(await page.getByRole('button', { name: 'Correct Mark', exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Correct Mark', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Request Mark Correction', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Release Updated Mark', exact: true }).count(), 0);
  control.held = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Refreshing mark issues' }).waitFor();
  assert.match(await body(page), /Please review fixture/); control.failures.add('get_staff_mark_issues'); control.release();
  await page.getByRole('alert').first().waitFor(); assert.match(await body(page), /Please review fixture/);
  // A successful empty class result and a failed first request remain distinct.
  await page.clock.install(); await page.clock.fastForward(31000);
  control.mode = 'empty'; await page.getByRole('button', { name: /Export Carry Marks/ }).click();
  await page.getByText('No class sections are available to export.', { exact: true }).waitFor();
  await page.clock.fastForward(31000);
  control.failures.add('class_sections'); await page.getByRole('button', { name: /Marks Entry & Eligibility/ }).click();
  await page.getByRole('alert').first().waitFor(); assert.doesNotMatch(await body(page), /has 0 class|No class sections yet/);
  control.failures.delete('class_sections'); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByText('No class sections yet. Select Add Class Section to create the first one.', { exact: true }).waitFor();
  assert.match(await body(page), /has 0 class sections/);
  // Empty assessment structure is a legitimate successful result with unset maximum.
  await page.getByRole('button', { name: /Assessment Structure/ }).click();
  await page.getByText('No assessment components yet. Select Add Assessment to create one.', { exact: true }).waitFor();
  assert.match(await body(page), /Not set/);
  // Nested empty/error responses must not be mistaken for each other.
  control.failures.delete('get_staff_mark_issues');
  await page.getByRole('button', { name: /Mark Issues/ }).click();
  await page.getByText('No mark issues have been reported for this subject.', { exact: true }).waitFor();
  control.failures.add('get_my_subject_assessment_structure');
  await page.getByRole('button', { name: /Assessment Structure/ }).click();
  await page.getByRole('alert').first().waitFor();
  assert.doesNotMatch(await body(page), /No assessment components|Not set|0% \/|Enter and save/);
  control.failures.add('get_staff_mark_issues');
  await page.getByRole('button', { name: /Mark Issues/ }).click();
  await page.getByRole('alert').first().waitFor();
  assert.doesNotMatch(await body(page), /No mark issues have been reported/);
  assert.deepEqual(s.errors, []); outcomes.push({ role: 'lecturer', mode, dark, held, passed: true }); await s.context.close();
}
module.exports = { start, chromium };
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CAMS_BROWSER_EXECUTABLE ? { executablePath: process.env.CAMS_BROWSER_EXECUTABLE } : {}) });
  try {
    for (const dark of [false, true]) {
      await adminScenario(browser, 'data', dark, true);
      await lecturerScenario(browser, 'data', dark, true);
    }
    for (const mode of ['data', 'empty', 'failure']) { await adminScenario(browser, mode, false, false); await lecturerScenario(browser, mode, false, false); }
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, syntheticBackend: true, scenarios: outcomes }, null, 2));
    console.log(`Passed ${outcomes.length} browser scenarios: fast/held responses, data/empty/error, tab switches, refresh, programme options, correction locks and both themes.`);
  } catch (error) {
    fs.writeFileSync(path.join(out, 'failure.txt'), String(error.stack)); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
