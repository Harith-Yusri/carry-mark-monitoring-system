import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = (await readFile('student-mobile-expo/src/lib/pushNotifications.ts','utf8')).replace(/^import .*;\n/gm,'');
const { code } = await transform(source, { loader:'ts', format:'cjs' });
function fixture(storage = new Map()) {
  const calls=[], registrations=[], listeners=[];
  let account='student-a', token='ExpoPushToken[initial]', fail=false, permission='granted', resolveGate=null;
  const native={type:'android',data:'native-initial'};
  const Notifications={
    setNotificationChannelAsync:async()=>{},getPermissionsAsync:async()=>({status:permission}),requestPermissionsAsync:async()=>({status:permission}),
    getExpoPushTokenAsync:async options=>{calls.push(options);if(!options.devicePushToken) for(const fn of listeners)fn(native);return {data:token};},
    addPushTokenListener:fn=>{listeners.push(fn);return {remove(){listeners.splice(listeners.indexOf(fn),1)}}},
  };
  const SecureStore={getItemAsync:async key=>storage.get(key)??null,setItemAsync:async(key,val)=>storage.set(key,val),deleteItemAsync:async key=>storage.delete(key)};
  const deps={Notifications,SecureStore,Constants:{easConfig:{projectId:'fixture-project'}},Device:{isDevice:true},Platform:{OS:'android'},AndroidImportance:{HIGH:4},router:{push(){}},
    getPushRegistrationAccount:async()=>account,
    registerPushDevice:async(...args)=>{if(resolveGate)await resolveGate;if(fail)throw Error('offline');registrations.push([account,...args]);},
    unregisterPushDevice:async installation=>registrations.push(['unregister',installation]),__DEV__:false};
  const api=new Function('module',...Object.keys(deps),code+';return module.exports;')({exports:{}},...Object.values(deps));
  const drain=async()=>{for(let i=0;i<80;i++)await Promise.resolve()};
  return {api,calls,registrations,storage,native,drain,listeners,setAccount:v=>account=v,setToken:v=>token=v,setFailure:v=>fail=v,setPermission:v=>permission=v,setGate:p=>resolveGate=p};
}
test('native token callback reuses supplied token and cannot recursively acquire it again',async()=>{
 const f=fixture();const errors=[];f.api.listenForPushTokenChanges(e=>errors.push(e));
 await f.api.registerForStudentPushNotifications();await f.drain();
 assert.equal(f.calls.length,2,'one startup fetch plus its one callback; no recursive loop');
 assert.deepEqual(f.calls[1].devicePushToken,f.native);
 assert.equal(f.registrations.length,1,'callback skips already confirmed unchanged registration');assert.deepEqual(errors,[]);
});
test('overlapping startup and repeated unchanged startups share writes and persisted success',async()=>{
 const f=fixture();await Promise.all([f.api.registerForStudentPushNotifications(),f.api.registerForStudentPushNotifications()]);
 assert.equal(f.calls.length,1);assert.equal(f.registrations.length,1);
 await f.api.registerForStudentPushNotifications();assert.equal(f.registrations.length,1);
});
test('token rotation, account changes, sign-out/re-register and preference invalidation remain effective',async()=>{
 const f=fixture();await f.api.registerForStudentPushNotifications();
 f.setToken('ExpoPushToken[rotated]');await f.api.registerForStudentPushNotifications({type:'android',data:'native-rotated'});assert.equal(f.registrations.length,2);
 f.setAccount('student-b');await f.api.registerForStudentPushNotifications();assert.equal(f.registrations.length,3);
 await f.api.invalidatePushRegistration();await f.api.registerForStudentPushNotifications();assert.equal(f.registrations.length,4);
 await f.api.unregisterCurrentPushInstallation();assert.equal(f.registrations[4][0],'unregister');
 await f.api.registerForStudentPushNotifications();assert.equal(f.registrations.length,6);
 assert.equal(new Set(f.registrations.filter(r=>r[0]!=='unregister').map(r=>r[1])).size,1,'same installation persists through account changes');
});
test('failed registration is never success-cached and can retry; denied permission does not write',async()=>{
 const f=fixture();f.setFailure(true);await assert.rejects(f.api.registerForStudentPushNotifications(),/offline/);
 f.setFailure(false);await f.api.registerForStudentPushNotifications();assert.equal(f.registrations.length,1);
 f.setPermission('denied');await f.api.invalidatePushRegistration();assert.equal(await f.api.registerForStudentPushNotifications(),null);assert.equal(f.registrations.length,1);
});
test('logout waits for an in-flight write before deactivating the device',async()=>{
 const f=fixture();let finish;f.setGate(new Promise(r=>finish=r));
 const registration=f.api.registerForStudentPushNotifications();await f.drain();
 const logout=f.api.unregisterCurrentPushInstallation();await f.drain();finish();await Promise.all([registration,logout]);
 assert.equal(f.registrations.at(-1)[0],'unregister');
 assert.equal(f.storage.has('cams.push.registration-v1'),false);
});

test('unchanged confirmed registration survives a fresh JS runtime and renews at most once per day',async()=>{
 const storage=new Map();const first=fixture(storage);await first.api.registerForStudentPushNotifications();assert.equal(first.registrations.length,1);
 const second=fixture(storage);await second.api.registerForStudentPushNotifications();assert.equal(second.registrations.length,0);
 const now=Date.now;try{const later=now()+24*60*60*1000+1;Date.now=()=>later;await second.api.registerForStudentPushNotifications();assert.equal(second.registrations.length,1);}finally{Date.now=now;}
});
