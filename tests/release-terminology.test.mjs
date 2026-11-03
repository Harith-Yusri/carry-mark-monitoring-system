import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

async function load(path, imports={}) {
  const {code}=await transform(await readFile(path,'utf8'),{loader:path.endsWith('tsx')?'tsx':'ts',format:'cjs'});
  return new Function('module','require',code+';return module.exports;')({exports:{}},name=>{
    if(name==='react')return React;
    if(name in imports)return imports[name];
    throw Error('Unexpected import: '+name);
  });
}
const web=await load('src/utils/releaseTerminology.ts');
const mobile=await load('student-mobile-expo/src/lib/releaseTerminology.ts');

test('web and student presentation translate all finalisation spellings and preserve case',()=>{
  for(const formatter of [web.releaseTerminology,mobile.releaseTerminology]) {
    for(const [input,output] of [
      ['Finalise Marks','Release Marks'],['Finalised','Released'],['FINALISED','RELEASED'],
      ['Partially Finalised','Partially Released'],['0 finalised','0 released'],
      ['Finalization complete','Release complete'],['finalization / finalisation','release / release'],
      ['lecturer finalises marks','lecturer releases marks'],['Finalizing / finalising','Releasing / releasing'],
      ['results were finalized','results were released'],['Finalizes marks','Releases marks'],
      ['marks_finalised / is_finalised / finalise_section','marks_finalised / is_finalised / finalise_section'],
    ])assert.equal(formatter(input),output);
  }
});

test('display statuses change while the stored model remains compatible',()=>{
  assert.equal(web.submissionStatusLabel('Finalised'),'Released');
  assert.equal(web.submissionStatusLabel('Partially Finalised'),'Partially Released');
  assert.equal(web.submissionStatusLabel('In Progress'),'Pending');
  assert.equal(web.submissionStatusLabel('Overdue'),'Overdue');
});

test('Admin badges keep semantic colors for unchanged underlying status values',async()=>{
  const {AdminStatus}=await load('src/features/admin/adminStyles.tsx',{
    '../../utils/releaseTerminology':web,
    '../../context/DarkModeContext':{},
  });
  for(const [status,label,tone] of [['Finalised','Released','success'],['Partially Finalised','Partially Released','pending'],['In Progress','Pending','pending'],['Overdue','Overdue','danger']]) {
    const html=renderToStaticMarkup(React.createElement(AdminStatus,{status}));
    assert(html.includes('admin-status-'+tone));assert(html.includes('>'+label+'<'));
    assert(!/finalis|finaliz/i.test(html));
  }
});
