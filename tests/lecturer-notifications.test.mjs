import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
const source = (await readFile('src/services/lecturerNotificationStore.ts','utf8')).replace(/^import .*;\n/gm,'');
const compiled = (await transform(source,{loader:'ts',format:'cjs'})).code;
const { LecturerNotificationStore: Store } = new Function('loadLecturerNotifications','openLecturerNotification','correctionError','module',compiled+';return module.exports;')(
  async()=>{},async()=>{},(_e,f)=>f,{exports:{}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const item=(id,read_at=null)=>({id,read_at,created_at:'2026-11-18T01:00:00Z',data:{studentName:'Student',subjectCode:'ITT550',classLabel:'Class A',assessmentName:'Quiz'}});
const page=(items=[item('n1')],unread_count=items.filter(n=>!n.read_at).length,has_more=false)=>({items,unread_count,has_more});
const target={notificationId:'n1',readAt:'2026-11-18T02:00:00Z',unreadCount:0,issueId:'issue1',subject:{offeringId:'o1'}};
test('bootstrap/focus/bell reads coalesce, unknown is not zero, and only stale focus rereads',async()=>{
  let now=1000,calls=0;const d=deferred();const s=new Store({load:()=>{calls++;return d.promise}},()=>now);
  assert.equal(s.snapshot().page,null);const a=s.refresh(),b=s.refresh();assert.equal(a,b);assert.equal(calls,1);
  d.resolve(page());await a;await s.refresh();assert.equal(calls,1);
  now+=30001;await s.refresh();assert.equal(calls,2);
});
test('open acknowledgement updates unread once, coalesces double click and preserves idempotence',async()=>{
  let opens=0;const d=deferred();const s=new Store({load:async()=>page(),open:()=>{opens++;return d.promise}});
  await s.refresh();const a=s.open('n1'),b=s.open('n1');assert.equal(a,b);assert.equal(opens,1);
  d.resolve(target);assert.deepEqual(await a,target);assert.equal(s.snapshot().page.unread_count,0);
  assert.equal(s.snapshot().page.items[0].read_at,target.readAt);
  s.externalRead('n1',target.readAt);assert.equal(s.snapshot().page.unread_count,0);
});
test('an older refresh cannot resurrect unread state after opening a notification',async()=>{
  let reads=0;const stale=deferred();const s=new Store({load:()=>++reads===2?stale.promise:Promise.resolve(page([item('n1',reads>2?target.readAt:null)],reads>2?0:1)),open:async()=>target});
  await s.refresh();const r=s.refresh(true);await s.open('n1');stale.resolve(page());await r;
  assert.equal(s.snapshot().page.unread_count,0);assert.equal(s.snapshot().page.items[0].read_at,target.readAt);
});
test('new event during a pending read is not lost, and error/empty states remain distinct',async()=>{
  let reads=0;const d=deferred();const s=new Store({load:()=>++reads===1?d.promise:Promise.resolve(page([item('n1'),item('n2')]))});
  const pending=s.refresh();s.incoming();s.incoming();d.resolve(page());await pending;
  assert.equal(reads,2);assert.equal(s.snapshot().page.unread_count,2);
  const failure=new Store({load:async()=>{throw new Error('offline')}});await failure.refresh();
  assert.equal(failure.snapshot().page,null);assert.match(failure.snapshot().error,/Unable/);
  const empty=new Store({load:async()=>page([])});await empty.refresh();assert.equal(empty.snapshot().page.unread_count,0);assert.equal(empty.snapshot().error,'');
});
test('failed read acknowledgement retains unread and successful data survives refresh failures',async()=>{
  let fail=false;const s=new Store({load:async()=>{if(fail)throw Error('offline');return page()},open:async()=>{throw Error('not owner')}});
  await s.refresh();await assert.rejects(s.open('n1'));assert.equal(s.snapshot().page.unread_count,1);
  fail=true;await s.refresh(true);assert.equal(s.snapshot().page.items.length,1);assert.match(s.snapshot().error,/Unable/);
});
test('older-page responses cannot overwrite newer acknowledgement, and disposal blocks late data',async()=>{
  const more=deferred();const s=new Store({load:cursor=>cursor?more.promise:Promise.resolve(page([item('n1')],1,true)),open:async()=>target});
  await s.refresh();const r=s.loadMore();await s.open('n1');more.resolve(page([item('n2')],1));await r;
  assert.equal(s.snapshot().page.unread_count,0);assert.equal(s.snapshot().page.items.length,1);
  const late=deferred(),disposed=new Store({load:()=>late.promise});const pending=disposed.refresh();disposed.dispose();late.resolve(page());await pending;assert.equal(disposed.snapshot().page,null);
});
