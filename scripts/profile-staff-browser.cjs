// Isolated local profiling harness. Synthetic test responses only; never contacts Supabase.
const {chromium}=require(process.env.CAMS_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');
const latency=Number(process.env.PROFILE_LATENCY_MS||200);
const baseUrl=process.env.PROFILE_BASE_URL||'http://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(baseUrl).hostname)) throw new Error('Profile only a local build, never a deployed site.');
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const programmes=['CS240','CS248','CS251','CS255'].map((code,i)=>({id:uid(20+i),code,name:'Profiling Programme '+(i+1)}));
const term={id:uid(30),academic_year:'2025/2026',semester_no:2,semester_code:'20262',default_deadline:'2026-12-31T23:59:00Z'};
const assessments=i=>Array.from({length:5},(_,j)=>({id:uid(1000+i*10+j),offering_id:uid(100+i),name:'Assessment '+(j+1),assessment_type:'Test',max_score:100,carry_weight:10,position:j}));
const classRows=i=>Array.from({length:i===3?4:3},(_,j)=>({id:uid(200+i*10+j),offering_id:uid(100+i),programme_id:programmes[j===3?3:0].id,label:'Class '+String.fromCharCode(65+j),day_of_week:null,starts_at:null,ends_at:null,room:null,capacity:20,join_code:'TEST-CODE',programmes:programmes[j===3?3:0]}));
const enrolments=i=>Array.from({length:6},(_,j)=>({id:uid(3000+i*10+j),section_id:classRows(i)[0].id,student_id:uid(4000+i*10+j),students:{matrix_no:'FIXTURE'+j,full_name:'Profiling Student '+j}}));
const marks=i=>enrolments(i).flatMap(e=>assessments(i).map(a=>({enrolment_id:e.id,assessment_id:a.id,score:50})));
const current=Array.from({length:4},(_,i)=>({offering_id:uid(100+i),programme_ids:[programmes[0].id],programme_codes:['CS240'],programme_names:[programmes[0].name],subject_code:['ITT588','ITT569','ITT593','ITT557'][i],subject_name:'Profiling Subject '+(i+1),programme_semester:i===1?6:i===3?4:5,student_count:6,offering_status:'active',updated_at:'2026-11-01T00:00:00Z',academic_year:term.academic_year,semester_no:2}));
function overview(){return {term,programmes,lecturers:[0,1].map((n)=>({auth_id:uid(10+n),staff_no:'STAFF'+n,full_name:'Profiling Lecturer '+n,allocations:(n===0?[0,1,2,3]:[0]).flatMap(i=>classRows(i).map((c,j)=>({offering_id:uid(100+n*10+i),offering_status:'active',offering_updated_at:'2026-11-01T00:00:00Z',subject_code:current[i].subject_code,subject_name:current[i].subject_name,section_id:c.id+n,class_label:c.label,programme_id:c.programme_id,programme_code:c.programmes.code,programme_name:c.programmes.name,section_updated_at:'2026-11-01T00:00:00Z',student_count:j===0?6:0,deadline_at:term.default_deadline,submission_status:j===0?'finalised':'draft',submission_updated_at:'2026-11-01T00:00:00Z'})))}))}}
(async()=>{
const browser=await chromium.launch({headless:true});const result={latencyMs:latency,scenarios:[]};
for(const role of ['admin','lecturer']){
 console.log('Profiling',role);
 const context=await browser.newContext({viewport:{width:1366,height:900}});const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));let requests=[],errors=[],reactOffset=0;
 const authUser={id:uid(role==='admin'?1:2),aud:'authenticated',role:'authenticated',email:'profiling@example.invalid',app_metadata:{provider:'email'},user_metadata:{}};
 const payload={exp:Math.floor(Date.now()/1000)+3600,sub:authUser.id,role:'authenticated',aud:'authenticated'};
 const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+Buffer.from('profiling-only').toString('base64url');
 await context.addInitScript(({user,token})=>{sessionStorage.setItem('sb-cueiilftoyqzvlrnmgfe-auth-token',JSON.stringify({access_token:token,refresh_token:'profiling-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));sessionStorage.setItem('carrymark.auth.lastActivity',String(Date.now()));}, {user:authUser,token});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://*.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),start=performance.now();let data;
  const offering=(url.searchParams.get('offering_id')||'').replace(/^eq\./,'');let index=current.findIndex(o=>o.offering_id===offering);if(index<0)index=0;
  if(url.pathname==='/auth/v1/user')data=authUser;
  else if(url.pathname.endsWith('/profiles'))data={id:authUser.id,staff_no:role==='admin'?'ADM-FIXTURE':'LECT-FIXTURE',full_name:'Profiling '+role,role,is_active:true};
  else if(url.pathname.endsWith('/get_admin_current_overview'))data=overview();
  else if(url.pathname.endsWith('/get_admin_semester_history'))data=[{id:uid(31),academic_year:'2024/2025',semester_code:'20252',semester_no:2,starts_on:'2025-01-01',ends_on:'2025-06-01',offering_count:4,class_count:13,enrolment_count:24,finalised_count:4}];
  else if(url.pathname.endsWith('/get_my_lecturer_subject_dashboard'))data={current,archived:[],term};
  else if(url.pathname.endsWith('/assessments'))data=assessments(index);
  else if(url.pathname.endsWith('/subject_offerings'))data={carry_max:50,academic_terms:{eligible_threshold:40}};
  else if(url.pathname.endsWith('/class_sections')){
   const filter=url.searchParams.get('offering_id')||'';const ids=filter.startsWith('in.')?current.map((o,i)=>filter.includes(o.offering_id)?i:-1).filter(i=>i>=0):[index];
   data=ids.flatMap(i=>classRows(i).map((c,j)=>({...c,enrolments:[{count:j===0?6:0}],submissions:j===0?[{status:'finalised'}]:[]})));
  }
  else if(url.pathname.endsWith('/enrolments')){
   const filter=url.searchParams.get('section_id')||'';const i=current.findIndex((_,i)=>filter.includes(classRows(i)[0].id));data=enrolments(Math.max(0,i));
  }
  else if(url.pathname.endsWith('/submissions')){
   const filter=url.searchParams.get('section_id')||'';const i=current.findIndex((_,i)=>filter.includes(classRows(i)[0].id));data=[{section_id:classRows(Math.max(0,i))[0].id,status:'finalised'}];
  }
  else if(url.pathname.endsWith('/marks')){
   const filter=url.searchParams.get('enrolment_id')||'';const i=current.findIndex((_,i)=>filter.includes(enrolments(i)[0].id));data=marks(Math.max(0,i));
  }
  else if(url.pathname.endsWith('/get_offering_student_totals')){const body=route.request().postDataJSON();const i=current.findIndex(o=>o.offering_id===body.target_offering);data=enrolments(Math.max(0,i)).map(e=>({enrolment_id:e.id,total_carry:25,eligible:false}));}
  else if(url.pathname.endsWith('/programmes'))data=programmes;
  else {errors.push('Unmocked request '+url.pathname);return route.abort();}
  const body=JSON.stringify(data);await new Promise(r=>setTimeout(r,latency));await route.fulfill({status:200,contentType:'application/json',body});requests.push({endpoint:url.pathname,ms:performance.now()-start,bytes:Buffer.byteLength(body),start,end:performance.now()});
 });
 async function measure(name,action,ready){console.log('Scenario',name);const m0=await metrics();const begin=performance.now(),offset=requests.length;await action();await ready();await page.waitForFunction(()=>!document.body.innerText.match(/Loading (academic operations|your subjects|semester history|assessment settings)/));await page.waitForTimeout(50);const end=performance.now();const req=requests.slice(offset);const js=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.match(/\/assets\/.*\.js/)).map(r=>({name:r.name.split('/').pop(),ms:r.duration,bytes:r.transferSize})));const m1=await metrics();const reactTimings=await page.evaluate(offset=>(window.__camsReactTimings||[]).slice(offset),reactOffset);reactOffset+=reactTimings.length;result.scenarios.push({name,reactRenderMs:reactTimings.reduce((sum,t)=>sum+t.actualDuration,0),reactCommits:reactTimings.length,jsMs:(m1.ScriptDuration-m0.ScriptDuration)*1000,layoutMs:(m1.LayoutDuration-m0.LayoutDuration)*1000,styleMs:(m1.RecalcStyleDuration-m0.RecalcStyleDuration)*1000,elapsedMs:end-begin-50,requests:req.map(({start,end,...rest})=>({...rest,startMs:start-begin,endMs:end-begin})),afterLastResponseMs:req.length?end-50-Math.max(...req.map(r=>r.end)):null,chunks:js,errors:[...errors]});}
 await measure(role+' initial restore',()=>page.goto(baseUrl+'/'+role+'/dashboard'),()=>page.getByRole('heading',{name:role==='admin'?'Academic Operations':'My Subjects',exact:true}).waitFor());
 if(role==='admin'){
  for(const [label,heading] of [['Submission Monitor','Submission Monitor'],['Lecturer Directory','Lecturer Directory'],['Reports & Exports','Reports & Exports'],['Past Semesters','Past Semesters']])await measure(label,()=>page.getByRole('button',{name:new RegExp(label.replace('&','\\&'))}).first().click(),()=>page.getByRole('heading',{name:heading,exact:true}).waitFor());
  await measure('Admin Dashboard revisit',()=>page.getByRole('button',{name:'Compliance Overview'}).click(),()=>page.getByRole('heading',{name:'Academic Operations',exact:true}).waitFor());
 }else{
  await measure('Subject Hub Assessments',()=>page.getByText('Profiling Subject 1',{exact:true}).click(),()=>page.waitForFunction(()=>{const input=document.querySelector('#subject-carry-max');return input && !input.disabled}));
  await measure('Marks Entry class selector',()=>page.getByRole('button',{name:/Marks Entry & Eligibility/}).click(),()=>page.getByRole('heading',{name:'Class A',exact:true}).first().waitFor());
  await measure('Marks Entry chosen class',()=>page.getByRole('button',{name:'Enter marks for Class A',exact:true}).click(),()=>page.getByRole('heading',{name:'Mark Entry — Class A',exact:true}).waitFor());
  await measure('Export class selector',()=>page.getByRole('button',{name:/Export Carry Marks/}).click(),()=>page.getByRole('heading',{name:'Class A',exact:true}).first().waitFor());
  await measure('Export chosen class',()=>page.getByRole('heading',{name:'Class A',exact:true}).first().click(),()=>page.getByRole('heading',{name:'e-Res Export',exact:true}).waitFor());
  await measure('My Subjects revisit',()=>page.getByRole('button',{name:'Back to My Subjects'}).click(),()=>page.getByText('Profiling Subject 1',{exact:true}).waitFor());
 }
 await context.close();
}
await browser.close();fs.writeFileSync(process.env.PROFILE_OUTPUT||'/tmp/cams-staff-browser-before.json',JSON.stringify(result,null,2));console.log(result.scenarios.map(s=>({name:s.name,ms:Math.round(s.elapsedMs),requests:s.requests.length,errors:s.errors.length})));if(result.scenarios.some(s=>s.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
