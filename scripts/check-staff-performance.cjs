// Same synthetic authenticated session, latency and fixture for before/after builds.
// This measures HTTP request dependency behavior and UI readiness, not real WAN/DB timing.
const { start, chromium } = require('./check-staff-loading.cjs');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CAMS_BROWSER_EXECUTABLE?{executablePath:process.env.CAMS_BROWSER_EXECUTABLE}:{})});
 const report={base:process.env.CAMS_LOADING_BASE_URL,fixtureLatencyMs:Number(process.env.CAMS_FIXTURE_LATENCY_MS||0),syntheticBackend:true,scenarios:[]};
 try{
  const s=await start(browser,'lecturer','data',false,false),{page,control}=s;
  await page.getByRole('button',{name:/Manage Subject Hub/}).first().waitFor();
  async function step(name,action,ready){const offset=control.results.length,started=performance.now();await action();await ready();await page.waitForTimeout(30);const requests=control.results.slice(offset);report.scenarios.push({name,readyMs:performance.now()-started-30,calls:requests.length,payloadBytes:requests.reduce((n,r)=>n+r.bytes,0),requests});}
  await step('Subject Hub assessments',()=>page.getByRole('button',{name:/Manage Subject Hub/}).first().click(),()=>page.getByText('Fixture Quiz',{exact:true}).waitFor());
  await step('Marks selector first visit',()=>page.getByRole('button',{name:/Marks Entry & Eligibility/}).click(),()=>page.getByRole('button',{name:'Enter marks for Class A',exact:true}).waitFor());
  await step('Selected class first visit',()=>page.getByRole('button',{name:'Enter marks for Class A',exact:true}).click(),()=>page.getByRole('heading',{name:'Mark Entry — Class A',exact:true}).waitFor());
  await step('Export selector first visit',()=>page.getByRole('button',{name:/Export Carry Marks/}).click(),()=>page.getByRole('button',{name:/Open e-Res Preview/}).first().waitFor());
  await step('Same class Export preview',()=>page.getByRole('button',{name:/Open e-Res Preview/}).first().click(),()=>page.getByRole('heading',{name:'e-Res Export',exact:true}).waitFor());
  await step('Marks selector return',()=>page.getByRole('button',{name:/Marks Entry & Eligibility/}).click(),()=>page.getByRole('button',{name:'Enter marks for Class A',exact:true}).waitFor());
  await step('Same class Marks return',()=>page.getByRole('button',{name:'Enter marks for Class A',exact:true}).click(),()=>page.getByRole('heading',{name:'Mark Entry — Class A',exact:true}).waitFor());
  await step('Sync Draft (read refresh only)',()=>page.getByRole('button',{name:'Sync Draft',exact:true}).click(),()=>page.getByRole('button',{name:'Draft Synced',exact:true}).waitFor());
  assert.deepEqual(s.errors,[]);await s.context.close();
  const admin=await start(browser,'admin','data',false,false);await admin.page.getByText('Fixture Lecturer',{exact:true}).first().waitFor();await admin.page.getByLabel('1 pending correction requests',{exact:true}).waitFor();
  const firstCount=admin.control.calls.filter(n=>n==='get_mark_correction_pending_count').length;
  const before=admin.control.calls.length;
  for(const nav of ['Submission Monitor','Lecturer Directory','Reports & Exports','Past Semesters','Compliance Overview']){
   await admin.page.getByRole('button',{name:new RegExp(nav)}).first().click();await admin.page.waitForTimeout(350);
  }
  const navCount=admin.control.calls.slice(before).filter(n=>n==='get_mark_correction_pending_count').length;
  await admin.page.getByRole('button',{name:/Mark Corrections/}).first().click();await admin.page.getByText('Fixture Student · FIXTURE1',{exact:true}).waitFor();
  const refreshOffset=admin.control.calls.length;await admin.page.getByRole('button',{name:'Refresh',exact:true}).click();await admin.page.waitForTimeout(600);
  report.correctionCounts={bootstrap:firstCount,unrelatedTabChanges:navCount,manualQueueRefresh:admin.control.calls.slice(refreshOffset).filter(n=>n==='get_mark_correction_pending_count').length};
  assert.deepEqual(admin.errors,[]);await admin.context.close();
  fs.writeFileSync(process.env.CAMS_PERF_OUTPUT||'/tmp/cams-perf-fixture.json',JSON.stringify(report,null,2));
  console.log(report.scenarios.map(({requests,...r})=>r),report.correctionCounts);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
