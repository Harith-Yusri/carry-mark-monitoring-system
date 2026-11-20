import test from 'node:test';
import assert from 'node:assert/strict';
import {academicTerms,localizedFunction} from './helpers/localization.mjs';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const {isRegularAcademicTerm,validateAcademicTermCode,formatAcademicTerm}=academicTerms;
test('only YYYY2/YYYY4 regular codes are accepted, including both requested examples',()=>{
 for(const code of ['20262','20264','20272','20274']){assert(isRegularAcademicTerm(code));assert.doesNotThrow(()=>validateAcademicTermCode(code,code.startsWith('2026')?'2025/2026':'2026/2027'))}
 for(const code of ['20261','20263','20265','20266','20269','202612','2026','abc24']){assert(!isRegularAcademicTerm(code));assert.throws(()=>validateAcademicTermCode(code,'2025/2026'))}
 assert.throws(()=>validateAcademicTermCode('20272','2025/2026'),/year must match/);assert.throws(()=>validateAcademicTermCode('20262','2025/2027'),/consecutive/);
});
test('unchanged historical identifiers remain intact; replacements must use the regular format',()=>{
 assert.doesNotThrow(()=>validateAcademicTermCode('20261','2025/2026','20261'));
 assert.throws(()=>validateAcademicTermCode('20263','2025/2026','20261'));
 assert.equal(formatAcademicTerm('20261','2025/2026'),'20261 · 2025/2026');
 assert.equal(formatAcademicTerm(undefined,'2025/2026'),'— · 2025/2026'); // Never fabricate a code from a semester number.
});
test('subject mapping and active context display the actual stored code independently from programme semester',async()=>{
 const {code}=await transform(await readFile('src/services/carryMarkApi.ts','utf8'),{loader:'ts',format:'cjs'});
 const row={offering_id:'offering',programme_ids:[],programme_codes:[],programme_names:[],subject_code:'COURSE',subject_name:'Semester 1',programme_semester:9,semester_no:2,academic_year:'2025/2026',semester_code:'20262'};
 const api=localizedFunction('module','require',code+';return module.exports;')({exports:{}},name=>name.includes('lecturerSubjectGroups')?{groupLecturerSubjects:rows=>rows}:{requireSupabase:()=>({rpc:async()=>({data:{term:row,current:[row],archived:[]},error:null})})});
 const subject=api.mapSubjectSummary(row);assert.equal(subject.termCode,'20262');assert.equal(subject.termLabel,'20262 · 2025/2026');assert.equal(subject.progSem,9);assert.equal(subject.name,'Semester 1');
 const dashboard=await api.loadLecturerSubjectDashboard();assert.equal(dashboard.activeTerm.termCode,'20262');
});
