// Real production UI; all academic/auth requests are synthetic and intercepted.
const { start, chromium } = require('./check-staff-loading.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs');
const catalogues=Object.fromEntries(['en','ms','zh','ta'].map(l=>[l,require('../student-mobile-expo/src/locales/'+l+'.json')]));
const out=process.env.CAMS_LOCALIZATION_OUTPUT||'/tmp/cams-i18n-evidence/browser';fs.mkdirSync(out,{recursive:true});
const text=(language,key,values={})=>{const dict=catalogues[language],found=Object.keys(dict).find(k=>k.trim().toLowerCase()===key.trim().toLowerCase());return (dict[key]??dict[found]??key).replace(/{{([^}]+)}}/g,(_,name)=>String(values[name.trim()]??''))};
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const results=[];
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CAMS_BROWSER_EXECUTABLE?{executablePath:process.env.CAMS_BROWSER_EXECUTABLE}:{})});try{
 for(const dark of [false,true])for(const lang of ['en','ms','zh','ta']){
  const s=await start(browser,'lecturer','data',dark,false),{page,control}=s;control.released=true;control.issue.corrections=[];control.issue.status='submitted';
  await page.getByRole('button',{name:/Manage Subject Hub/}).first().waitFor();await page.waitForTimeout(150);
  const before=control.calls.length;await page.getByTestId('language-select').selectOption(lang);
  await page.getByRole('heading',{name:text(lang,'My Subjects'),exact:true}).waitFor();await page.waitForTimeout(150);assert.equal(control.calls.length,before,'locale must not request academic/auth data');
  assert.equal(await page.evaluate(()=>localStorage.getItem('cams.language.v1')),lang);
  await page.getByRole('button',{name:new RegExp(escape(text(lang,'Manage Subject Hub')))}).first().click();
  await page.getByRole('button',{name:new RegExp(escape(text(lang,'Marks Entry & Eligibility')))}).click();
  await page.getByRole('button',{name:text(lang,'Enter marks for {{value0}}',{value0:'Class A'}),exact:true}).click();
  await page.getByRole('heading',{name:text(lang,'Mark Entry — {{value0}}',{value0:'Class A'}),exact:true}).waitFor();
  const cell=page.getByRole('spinbutton',{name:text(lang,'{{value0}} mark for {{value1}}',{value0:'Fixture Quiz',value1:'Fixture Student'}),exact:true});assert.equal(await cell.inputValue(),'50');assert(await cell.isDisabled());
  await page.getByRole('button',{name:text(lang,'Edit released mark for {{value0}}: {{value1}}',{value0:'Fixture Student',value1:'Fixture Quiz'}),exact:true}).click();
  const modal=page.getByRole('dialog');await modal.getByText(text(lang,'Current Released score'),{exact:true}).waitFor();
  await modal.locator('#released-correction-reason').fill('Eligible / Reject / தமிழ் / {{value0}}');await modal.locator('#released-correction-score').fill('80');
  const calls=control.calls.length;
  for(const next of ['ta','zh','ms','en',lang]){await page.getByTestId('language-select').selectOption(next);assert.equal(await modal.locator('#released-correction-reason').inputValue(),'Eligible / Reject / தமிழ் / {{value0}}');assert.equal(await modal.locator('#released-correction-score').inputValue(),'80')}
  await page.waitForTimeout(120);assert.equal(control.calls.length,calls);assert.equal(control.score,50);assert.match(await modal.innerText(),/Fixture Student · FIXTURE1/);assert.match(await modal.innerText(),/Fixture Quiz/);
  if(lang==='ta'){await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${out}/lecturer-ta-${dark}.png`});await page.setViewportSize({width:1366,height:900})}
  await modal.getByRole('button',{name:text(lang,'Close correction'),exact:true}).click();
  await page.getByRole('button',{name:new RegExp(escape(text(lang,'Mark Issues')))}).click();await page.getByText('Please review fixture',{exact:true}).waitFor();
  assert(await page.getByRole('button',{name:text(lang,'Reject'),exact:true}).isDisabled());assert(await page.getByRole('button',{name:text(lang,'Correct Mark'),exact:true}).isDisabled());
  assert.deepEqual(s.errors,[]);results.push({role:'lecturer',lang,dark,passed:true});await s.context.close();
  const a=await start(browser,'admin','data',dark,false);await a.page.getByRole('heading',{name:'Academic Operations',exact:true}).waitFor();await a.page.getByTestId('language-select').selectOption(lang);
  for(const menu of ['Submission Monitor','Lecturer Directory','Reports & Exports','Past Semesters','System Settings','Compliance Overview']){await a.page.getByRole('button',{name:new RegExp('^'+escape(text(lang,menu)))}).first().click();await a.page.waitForTimeout(80);assert(!(await a.page.locator('body').innerText()).includes('[object Object]'))}
  assert.deepEqual(a.errors,[]);if(lang==='ta')await a.page.screenshot({path:`${out}/admin-ta-${dark}.png`});results.push({role:'admin',lang,dark,passed:true});await a.context.close();
 }
 const s=await start(browser,'lecturer','data',false,false),p=s.page;await p.getByRole('heading',{name:'My Subjects',exact:true}).waitFor();
 await p.evaluate(()=>{Object.defineProperty(navigator,'languages',{configurable:true,value:['ms-MY']});window.dispatchEvent(new Event('languagechange'))});await p.getByTestId('language-select').selectOption('auto');await p.getByRole('heading',{name:text('ms','My Subjects'),exact:true}).waitFor();
 await p.evaluate(()=>{Object.defineProperty(navigator,'languages',{configurable:true,value:['fr-FR']});window.dispatchEvent(new Event('languagechange'))});await p.getByRole('heading',{name:'My Subjects',exact:true}).waitFor();
 await p.getByTestId('language-select').selectOption('ta');await p.reload();await p.getByRole('heading',{name:text('ta','My Subjects'),exact:true}).waitFor();assert.equal(await p.getByTestId('language-select').inputValue(),'ta');assert.deepEqual(s.errors,[]);await s.context.close();results.push({autoDetection:true,unsupportedFallback:true,reloadPersistence:true,passed:true});
 const context=await browser.newContext();const auth=await context.newPage();await auth.route('https://*.supabase.co/**',route=>route.abort());await auth.goto((process.env.CAMS_LOADING_BASE_URL||'http://127.0.0.1:4178')+'/');
 for(const lang of ['en','ms','zh','ta']){await auth.getByTestId('language-select').selectOption(lang);await auth.getByRole('button',{name:text(lang,'Continue to Staff Portal'),exact:true}).waitFor()}
 await auth.goto((process.env.CAMS_LOADING_BASE_URL||'http://127.0.0.1:4178')+'/register');for(const lang of ['en','ms','zh','ta']){await auth.getByTestId('language-select').selectOption(lang);await auth.getByRole('heading',{name:text(lang,'Create your CAMS account'),exact:true}).waitFor()}
 await context.close();results.push({auth:true,registration:true,passed:true});fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`Passed ${results.length} localization browser scenarios: four locales, both roles/themes, typed correction preservation, unchanged requests/data, Auto/fallback, reload persistence and login.`);
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
