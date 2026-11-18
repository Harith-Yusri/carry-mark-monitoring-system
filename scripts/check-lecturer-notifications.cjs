// Local/live-hosted frontend only. All REST and Realtime traffic is intercepted.
const { start, chromium } = require('./check-staff-loading.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const out=process.env.CAMS_BELL_OUTPUT||'/tmp/cams-bell-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CAMS_BROWSER_EXECUTABLE?{executablePath:process.env.CAMS_BROWSER_EXECUTABLE}:{})});
 try {
  for (const dark of [false,true]) {
   const s=await start(browser,'lecturer','data',dark,false),{page,control}=s;
   if(dark) await page.setViewportSize({width:390,height:844});
   await page.getByRole('button',{name:'Notifications, 1 unread',exact:true}).waitFor();
   const initial=control.calls.filter(n=>n==='get_my_lecturer_notifications').length;
   await page.getByRole('button',{name:'Notifications, 1 unread',exact:true}).click();
   const panel=page.getByRole('region',{name:'Lecturer notifications',exact:true});
   await panel.getByText('ITT550 · Class A',{exact:true}).waitFor();
   await panel.getByText('Fixture Quiz',{exact:true}).waitFor();
   const bounds=await panel.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=page.viewportSize().width);
   await page.screenshot({path:path.join(out,`bell-${dark?'dark-mobile':'light'}.png`)});
   assert.equal(control.calls.filter(n=>n==='get_my_lecturer_notifications').length,initial);
   await panel.getByRole('button',{name:/Fixture Student/}).click();
   await page.getByRole('button',{name:'Notifications, 0 unread',exact:true}).waitFor();
   const article=page.getByRole('article',{name:'Fixture Student · Fixture Quiz mark issue',exact:true});
   await article.waitFor();assert.match(await article.getAttribute('class'),/ring-2/);
   assert.equal(await article.evaluate(n=>n===document.activeElement),true);
   assert.equal(await page.getByRole('button',{name:/Mark Issues/,pressed:true}).count(),1);
   assert.equal(control.calls.filter(n=>n==='open_my_mark_issue_notification').length,1);
   // Clicking the same already-read alert must return from another tab too.
   await page.getByRole('button',{name:/Assessment Structure/}).click();
   await page.getByRole('button',{name:'Notifications, 0 unread',exact:true}).click();
   await panel.getByRole('button',{name:/Fixture Student/}).click();
   await article.waitFor();assert.equal(await page.getByRole('button',{name:/Mark Issues/,pressed:true}).count(),1);
   assert.equal(control.notifications[0].read_at!==null,true);
   // Incoming event uses the one subscription; a burst only refreshes once.
   const next={...control.notifications[0],id:'00000000-0000-4000-8000-000000000601',read_at:null};
   control.notifications.unshift(next);const before=control.calls.filter(n=>n==='get_my_lecturer_notifications').length;
   control.emitNotification(next);control.emitNotification(next);
   await page.getByRole('button',{name:'Notifications, 1 unread',exact:true}).waitFor();
   assert.equal(control.calls.filter(n=>n==='get_my_lecturer_notifications').length,before+1);
   await page.getByRole('button',{name:'Notifications, 1 unread',exact:true}).click();
   control.held=true;
   await panel.getByRole('button',{name:'Refresh notifications',exact:true}).click();
   await panel.getByRole('status').filter({hasText:'Refreshing notifications'}).waitFor();
   assert.match(await panel.innerText(),/Fixture Student/);
   control.failures.add('get_my_lecturer_notifications');control.release();
   await panel.getByRole('alert').waitFor();assert.match(await panel.innerText(),/Fixture Student/);
   assert.deepEqual(s.errors,[]);await s.context.close();
  }
  for (const mode of ['empty','failure']) {
   const s=await start(browser,'lecturer',mode,false,true),{page,control}=s;
   await page.getByRole('button',{name:'Loading notifications',exact:true}).click();
   const panel=page.getByRole('region',{name:'Lecturer notifications',exact:true});
   await panel.getByRole('status').filter({hasText:'Loading notifications'}).waitFor();
   assert.doesNotMatch(await panel.innerText(),/No mark-issue notifications/);
   control.release();
   if(mode==='empty') {await page.getByRole('button',{name:'Notifications, 0 unread',exact:true}).waitFor();await panel.getByText('No mark-issue notifications yet.',{exact:true}).waitFor();}
   else {await panel.getByRole('alert').waitFor();assert.doesNotMatch(await panel.innerText(),/No mark-issue notifications/);}
   assert.deepEqual(s.errors,[]);await s.context.close();
  }
  const admin=await start(browser,'admin','data',false,false);
  assert.equal(await admin.page.getByRole('button',{name:/Notifications, \d+ unread/}).count(),0);
  assert.equal(admin.control.calls.includes('get_my_lecturer_notifications'),false);await admin.context.close();
  console.log('Passed lecturer bell: read/Hub/issue focus, real-time insert, coalescing, retained refresh error, unknown/empty/error, both themes and Admin exclusion.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
