import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
const {code}=await transform((await readFile('src/services/subjectClassCache.ts','utf8')).replace(/^import .*;\n/gm,''),{loader:'ts',format:'cjs'});
const {SubjectClassCache}=new Function('module',code+';return module.exports;')({exports:{}});
test('Hub cache coalesces reads across Marks/Export and invalidates just selected detail',async()=>{
 const c=new SubjectClassCache();let reads=0,release;const fetch=()=>{reads++;return new Promise(r=>release=r)};
 const a=c.readDetail('a',fetch),b=c.readDetail('a',fetch);await new Promise(resolve=>setImmediate(resolve));release({value:1});await Promise.all([a,b]);assert.equal(reads,1);
 assert.deepEqual(await c.readDetail('a',async()=>{throw Error('unexpected');}),{value:1});
 await c.readDetail('b',async()=>({value:2}));c.invalidate('a');
 assert.deepEqual(await c.readDetail('b',async()=>{throw Error('unexpected');}),{value:2});
 assert.deepEqual(await c.readDetail('a',async()=>({value:3})),{value:3});
});
test('cache never resurrects invalidated in-flight data, errors, expired data or another Hub/user instance',async()=>{
 const c=new SubjectClassCache();let finish;const pending=c.readDetail('a',()=>new Promise(r=>finish=r));await new Promise(resolve=>setImmediate(resolve));c.invalidate();finish({old:true});await pending;
 assert.deepEqual(await c.readDetail('a',async()=>({fresh:true})),{fresh:true});
 await assert.rejects(c.readDetail('bad',async()=>{throw Error('offline')}));assert.deepEqual(await c.readDetail('bad',async()=>({retry:true})),{retry:true});
 const original=Date.now;try{const now=original();Date.now=()=>now+31000;assert.deepEqual(await c.readDetail('a',async()=>({expired:true})),{expired:true});}finally{Date.now=original;}
 const other=new SubjectClassCache();assert.deepEqual(await other.readDetail('a',async()=>({other:true})),{other:true});
});

test('Export waits for an in-flight mark save before reading server-confirmed detail',async()=>{
 const cache=new SubjectClassCache();let finish,saved=false;
 const write=cache.write('a',()=>new Promise(resolve=>finish=()=>{saved=true;resolve()}));
 await Promise.resolve();let readStarted=false;
 const read=cache.readDetail('a',async()=>{readStarted=true;assert.equal(saved,true);return {saved:true}});
 await Promise.resolve();assert.equal(readStarted,false);finish();await write;assert.deepEqual(await read,{saved:true});
});

test('a deferred local edit is flushed before background or Export revalidation',async()=>{
 const cache=new SubjectClassCache();let flushed=false;
 const remove=cache.setFlusher('a',async()=>{await cache.write('a',async()=>{flushed=true})});
 const result=await cache.readDetail('a',async()=>{assert.equal(flushed,true);return {fresh:true}});
 assert.deepEqual(result,{fresh:true});remove();
});
