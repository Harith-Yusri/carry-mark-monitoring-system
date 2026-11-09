import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = (await readFile('src/hooks/useSubjectClassData.ts', 'utf8')).replace(/^import .*;\n/gm, '');
const { code: hookCode } = await transform(source, { loader: 'ts', format: 'cjs' });
const summary = (id, offeringId) => ({ id, offeringId, programmeId: 'programme-'+id, programmeCode: 'CS'+id, studentCount: 1, label: 'Class '+id, capacity: 10, finalised: false, joinCode: 'CODE-'+id });
const detail = row => ({ data: { assessments: [{ id: 'assessment-'+row.id }], sections: [{...row, students: [{enrolmentId:'enrolment-'+row.id,scores:{},totalCarry:0}]}] }, settings: {carryMax:50,eligibleThreshold:40} });

function harness({ loadDetail = async row => detail(row), loadSummaries = async () => [summary('a','offering-a'),summary('b','offering-b')] } = {}) {
  const slots=[]; let cursor=0, dirty=true, value, effects=[];
  const calls={summary:0,detail:[]};
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const hooks={
    useState(initial) { const i=cursor++;if(!slots[i])slots[i]={value:initial};const slot=slots[i];return [slot.value,next=>{const v=typeof next==='function'?next(slot.value):next;if(!Object.is(v,slot.value)){slot.value=v;dirty=true}}]; },
    useRef(initial) { const i=cursor++;return slots[i]??(slots[i]={current:initial}); },
    useCallback(fn,deps) { const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,fn};return slots[i].fn; },
    useEffect(fn,deps) { const i=cursor++;const previous=slots[i];if(!previous||!same(previous.deps,deps)){slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn()})} },
  };
  const module={exports:{}};
  new Function('module',...Object.keys(hooks),'loadSubjectClassSummaries','loadSubjectClassDetail','userError',hookCode)(module,...Object.values(hooks),
    async()=>{calls.summary++;return loadSummaries()},async row=>{calls.detail.push(row.id);return loadDetail(row)},(_reason,fallback)=>fallback);
  const hook=module.exports.useSubjectClassData;
  const flush=async()=>{for(let i=0;i<30;i++){if(dirty){dirty=false;cursor=0;effects=[];value=hook('offering-a',['offering-a','offering-b']);for(const effect of effects)effect()}await Promise.resolve()}return value};
  return {flush,calls,get value(){return value},unmount(){for(const slot of slots)slot?.cleanup?.()}};
}

test('initial class selectors load summaries once and do not fetch marks or assessments',async()=>{
  const app=harness();const value=await app.flush();
  assert.equal(app.calls.summary,1);assert.deepEqual(app.calls.detail,[]);
  assert.equal(value.sections.length,2);assert.equal(value.loading,false);assert.equal(value.selected,null);
  app.unmount();
});

test('choosing a class loads only its offering context and preserves score edits and reload',async()=>{
  const app=harness();await app.flush();app.value.setSelectedId('b');await app.flush();
  assert.deepEqual(app.calls.detail,['b']);assert.equal(app.value.selected.id,'b');assert.equal(app.value.assessments[0].id,'assessment-b');
  app.value.updateDetailedSections(rows=>rows.map(row=>({...row,students:row.students.map(student=>({...student,scores:{'assessment-b':42}}))})));
  await app.flush();assert.equal(app.value.selected.students[0].scores['assessment-b'],42);
  await app.value.reload();await app.flush();assert.deepEqual(app.calls.detail,['b','b']);assert.equal(app.calls.summary,2);
  app.unmount();
});

test('a late response for a previously selected class cannot replace the current class',async()=>{
  let finishA;const app=harness({loadDetail:row=>row.id==='a'?new Promise(resolve=>finishA=()=>resolve(detail(row))):Promise.resolve(detail(row))});
  await app.flush();app.value.setSelectedId('a');await app.flush();app.value.setSelectedId('b');await app.flush();
  assert.equal(app.value.selected.id,'b');finishA();await app.flush();assert.equal(app.value.selected.id,'b');app.unmount();
});

test('detail failures show an error while summaries remain available and retry recovers',async()=>{
  let fail=true;const app=harness({loadDetail:async row=>{if(fail)throw new Error('network');return detail(row)}});
  await app.flush();app.value.setSelectedId('a');await app.flush();
  assert.equal(app.value.detailLoading,false);assert.ok(app.value.error);assert.equal(app.value.sections.length,2);assert.equal(app.value.selected,null);
  fail=false;await app.value.reload();await app.flush();assert.equal(app.value.selected.id,'a');assert.equal(app.value.error,'');app.unmount();
});

test('mutation reload uses the new invitation code and class metadata',async()=>{
  let changed=false;const app=harness({loadSummaries:async()=>[{...summary('a','offering-a'),joinCode:changed?'NEW-CODE':'OLD-CODE'}]});
  await app.flush();app.value.setSelectedId('a');await app.flush();assert.equal(app.value.selected.joinCode,'OLD-CODE');
  changed=true;await app.value.reload();await app.flush();assert.equal(app.value.selected.joinCode,'NEW-CODE');app.unmount();
});

const {code:apiCode}=await transform(await readFile('src/services/carryMarkApi.ts','utf8'),{loader:'ts',format:'cjs'});
function apiFixture(errorTable=null){
  const calls=[];
  const rows={
    class_sections:[{id:'a',offering_id:'offering-a',programme_id:'p',label:'Class A',capacity:10,join_code:'CODE',programmes:{code:'CS240',name:'Programme'},enrolments:[{count:1}],submissions:[{status:'finalised'}]}],
    assessments:[{id:'assessment-a',name:'Test',assessment_type:'Test',max_score:100,carry_weight:50,position:0}],
    subject_offerings:{carry_max:50,academic_terms:{eligible_threshold:40}},
    enrolments:[{id:'enrolment-a',student_id:'student-a',section_id:'a',students:{matrix_no:'FIXTURE',full_name:'Fixture'}}],
    submissions:[{section_id:'a',status:'finalised'}],marks:[{enrolment_id:'enrolment-a',assessment_id:'assessment-a',score:80}],
  };
  const db={from(table){const call={table,filters:[]};const query={};for(const method of ['select','eq','in','order','single'])query[method]=(...args)=>{if(method==='select')call.select=args[0];else call.filters.push([method,...args]);return query};query.then=resolve=>{calls.push(call);return Promise.resolve({data:rows[table],error:table===errorTable?new Error('backend error'):null}).then(resolve)};return query},async rpc(name,args){calls.push({table:name,args});return {
    data: name === 'get_staff_class_detail' ? {
      data:{assessments:[{id:'assessment-a',name:'Test',type:'Test',maxMarks:100,weightage:50,position:0}],sections:[{...summary('a','offering-a'),finalised:true,students:[{enrolmentId:'enrolment-a',scores:{'assessment-a':80},totalCarry:40,eligible:true}]}]},
      settings:{carryMax:50,eligibleThreshold:40}
    } : [{enrolment_id:'enrolment-a',total_carry:40,eligible:true}],
    error:name===errorTable?new Error('backend error'):null}}};
  const module={exports:{}};new Function('module','require',apiCode)(module,name=>name.includes('lecturerSubjectGroups')?{groupLecturerSubjects:x=>x}:{requireSupabase:()=>db});
  return {api:module.exports,calls};
}

test('summary query returns only class metadata, aggregate enrolment count and true submission state',async()=>{
  const {api,calls}=apiFixture();const result=await api.loadSubjectClassSummaries(['offering-a','offering-a']);
  assert.equal(calls.length,1);assert.equal(calls[0].table,'class_sections');
  assert.equal(result[0].studentCount,1);assert.equal(result[0].finalised,true);
  assert.equal('students' in result[0],false);assert.ok(calls[0].select.includes('enrolments(count)'));
  assert.equal(calls.some(call=>['marks','students'].includes(call.table)),false);
});

test('selected-class fast path preserves assessment IDs, marks, totals and finalisation without querying other classes',async()=>{
  const {api,calls}=apiFixture();const result=await api.loadSubjectClassDetail({...summary('a','offering-a'),programmeName:'Programme'});
  assert.equal(calls.length,1);assert.equal(calls.some(call=>call.table==='class_sections'),false);
  assert.equal(result.data.sections.length,1);assert.equal(result.data.sections[0].id,'a');assert.equal(result.data.sections[0].finalised,true);
  assert.equal(result.data.sections[0].students[0].scores['assessment-a'],80);
  assert.equal(result.data.sections[0].students[0].totalCarry,40);assert.equal(result.data.sections[0].students[0].eligible,true);
  assert.deepEqual(calls[0],{table:'get_staff_class_detail',args:{target_section:'a'}});
});

test('summary and selected-class loader errors propagate rather than producing fake empty data',async()=>{
  await assert.rejects(apiFixture('class_sections').api.loadSubjectClassSummaries(['offering-a']),/backend error/);
  await assert.rejects(apiFixture('get_staff_class_detail').api.loadSubjectClassDetail(summary('a','offering-a')),/backend error/);
});

test('pending summaries remain unknown until even an empty response succeeds', async () => {
  let resolve;
  const app = harness({ loadSummaries: () => new Promise(done => { resolve = done; }) });
  await app.flush();
  assert.equal(app.value.loading, true);
  assert.equal(app.value.hasLoaded, false, 'an initial empty array is not a loaded zero count');
  resolve([]); await app.flush();
  assert.equal(app.value.loading, false);
  assert.equal(app.value.hasLoaded, true);
  assert.equal(app.value.sections.length, 0, 'zero is real only after success');
  app.unmount();
});

test('failed initial summaries remain an error rather than a loaded empty result', async () => {
  const app = harness({ loadSummaries: async () => { throw Error('offline'); } });
  await app.flush();
  assert.equal(app.value.loading, false);
  assert.equal(app.value.hasLoaded, false);
  assert.ok(app.value.error);
  app.unmount();
});

test('background summary failure retains the previously successful class list', async () => {
  let reject, refresh = false;
  const app = harness({ loadSummaries: () => refresh ? new Promise((_, fail) => { reject = fail; }) : Promise.resolve([summary('a', 'offering-a')]) });
  await app.flush(); refresh = true;
  const pending = app.value.reload().catch(() => undefined);
  await app.flush();
  assert.equal(app.value.hasLoaded, true);
  assert.equal(app.value.loading, true);
  assert.equal(app.value.sections[0].id, 'a');
  reject(Error('offline')); await pending; await app.flush();
  assert.ok(app.value.error);
  assert.equal(app.value.hasLoaded, true);
  assert.equal(app.value.sections[0].id, 'a');
  app.unmount();
});
