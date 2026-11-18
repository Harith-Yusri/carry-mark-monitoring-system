// Compiled frontend only; all REST/WebSocket traffic is intercepted by start().
const { start, chromium } = require('./check-staff-loading.cjs');
const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=process.env.CAMS_EDIT_MARK_OUTPUT||'/tmp/cams-edit-mark-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CAMS_BROWSER_EXECUTABLE?{executablePath:process.env.CAMS_BROWSER_EXECUTABLE}:{})});
 async function ready(dark=false,released=true) {
  const s=await start(browser,'lecturer','data',dark,false);s.control.released=released;
  s.page.on('dialog',dialog=>dialog.accept());
  await s.page.getByRole('button',{name:/Manage Subject Hub/}).first().click();
  await s.page.getByRole('button',{name:/Marks Entry & Eligibility/}).click();
  await s.page.getByRole('button',{name:'Enter marks for Class A',exact:true}).click();
  await s.page.getByRole('heading',{name:'Mark Entry — Class A',exact:true}).waitFor();return s;
 }
 try {
  for(const dark of [false,true]) {
   const {page,control,context,errors}=await ready(dark);
   const locked=page.getByRole('spinbutton',{name:'Fixture Quiz mark for Fixture Student',exact:true});
   assert.equal(await locked.isDisabled(),true);
   await page.getByRole('button',{name:'Edit released mark for Fixture Student: Fixture Quiz',exact:true}).click();
   const modal=page.getByRole('dialog',{name:'Edit Released Mark',exact:true});
   await modal.getByText('Current Released score',{exact:true}).waitFor();
   assert.match(await modal.innerText(),/Fixture Student · FIXTURE1/);assert.match(await modal.innerText(),/ITT550 · Class A/);
   assert.equal(await modal.getByRole('button',{name:'Save Correction',exact:true}).isDisabled(),true);
   assert.equal(await modal.getByRole('button',{name:'Release Updated Mark',exact:true}).isDisabled(),true);
   const score=modal.getByLabel('Corrected score (maximum 100)',{exact:true}),reason=modal.getByLabel('Correction reason (required)',{exact:true});
   await score.fill('80');assert.equal(await modal.getByRole('button',{name:'Save Correction',exact:true}).isDisabled(),true);
   await reason.fill('Lecturer verified an entry error.');
   for(const bad of ['-1','101','80.001','50']) {await score.fill(bad);assert.equal(await modal.getByRole('button',{name:'Save Correction',exact:true}).isDisabled(),true);}
   await score.fill('80');
   await modal.getByRole('button',{name:'Save Correction',exact:true}).evaluate(button=>{button.click();button.click()});
   await modal.getByText(/Correction saved privately/).waitFor();
   assert.equal(control.score,50);assert.equal(await locked.inputValue(),'50');assert.equal(await locked.isDisabled(),true);
   assert.equal(control.calls.filter(n=>n==='stage_released_mark_correction').length,1);
   assert.equal(control.calls.filter(n=>n==='release_corrected_mark').length,0);
   assert.equal(await modal.getByRole('button',{name:'Save Correction',exact:true}).isDisabled(),true);
   if(dark)await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:path.join(out,`released-correction-${dark?'dark-mobile':'light'}.png`)});
   await modal.getByRole('button',{name:'Close correction',exact:true}).click();
   await page.getByRole('button',{name:'Edit released mark for Fixture Student: Fixture Quiz',exact:true}).click();
   await modal.getByText(/Saved correction: 80/).waitFor();assert.equal(await score.inputValue(),'80');
   await modal.getByRole('button',{name:'Release Updated Mark',exact:true}).click();
   await modal.getByText(/Updated mark released\./).waitFor();
   await page.waitForFunction(()=>document.querySelector('input[aria-label="Fixture Quiz mark for Fixture Student"]').value==='80');
   assert.equal(await locked.isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Carry Marks Released',exact:true}).isDisabled(),true);
   assert.equal(control.calls.filter(n=>n==='release_corrected_mark').length,1);assert.equal(control.calls.includes('marks'),false);
   await modal.getByRole('button',{name:'Close correction',exact:true}).click();
   assert.equal(await page.getByText('ELIGIBLE',{exact:true}).count(),1);
   assert.deepEqual(errors,[]);await context.close();
  }
  const s=await ready();const {page,control}=s;
  control.held=true;
  await page.getByRole('button',{name:'Edit released mark for Fixture Student: Fixture Quiz',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Edit Released Mark',exact:true});
  await modal.getByRole('status').filter({hasText:'Loading the selected Released mark'}).waitFor();
  assert.doesNotMatch(await modal.innerText(),/Current Released score|0 \/ 100/);
  control.failures.add('get_released_mark_correction_context');control.release();await modal.getByRole('alert').waitFor();
  control.failures.clear();await modal.getByRole('button',{name:'Try again',exact:true}).click();await modal.getByText('Current Released score',{exact:true}).waitFor();
  assert.deepEqual(s.errors,[]);await s.context.close();
  const draft=await ready(false,false);assert.equal(await draft.page.getByRole('button',{name:/Edit released mark/}).count(),0);await draft.context.close();
  console.log('Passed released Edit Mark: exact locked cell, validation/reason, private save, duplicate click, persisted draft, release/reload/eligibility, both themes/mobile, first-load/error/retry and no Edit control for draft marks.');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
