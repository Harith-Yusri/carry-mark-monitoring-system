import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { core } from './helpers/localization.mjs';
const memory = value => ({ value, read() { return this.value; }, write(next) { this.value = next; } });
test('Auto detects supported browser/device tags and falls back to English', () => {
 for(const [tags,want] of [[['ms-MY'],'ms'],[['zh-Hans-MY'],'zh'],[['zh_TW'],'zh'],[['ta-IN'],'ta'],[['en-GB'],'en'],[['fr-FR','ta-MY'],'ta'],[['fr-FR','de'],'en'],[[],'en']]) assert.equal(core.detectLanguage(tags),want);
 assert.equal(core.validPreference('bogus'),'auto');assert.equal(core.validPreference(null),'auto');
});
test('manual selection overrides detection, persists and survives reopening without auth or data access',async()=>{
 let tags=['ms-MY'];const storage=memory(null),app=core.createLocalization(()=>tags);let changes=0;const stop=app.subscribe(()=>changes++);
 assert.equal(app.locale(),'ms');
 for(const value of ['ta','zh','ms','en','ta']){await app.setPreference(value,storage);assert.equal(app.locale(),value);assert.equal(storage.value,value)}
 tags=['zh-CN'];app.detect();assert.equal(app.locale(),'ta');
 const reopened=core.createLocalization(()=>tags);await reopened.restore(storage);assert.equal(reopened.locale(),'ta');
 await app.setPreference('auto',storage);assert.equal(app.locale(),'zh');tags=['fr'];app.detect();assert.equal(app.locale(),'en');
 stop();assert(changes>=7);
});
test('late SecureStore restore cannot override a manual choice and rapid writes finish with the latest preference',async()=>{
 let resolveRead;const writes=[];const storage={read:()=>new Promise(resolve=>resolveRead=resolve),write:async value=>{await new Promise(resolve=>setTimeout(resolve,2));writes.push(value)}};
 const app=core.createLocalization(()=>['en']);const restore=app.restore(storage);const first=app.setPreference('ms',storage);const last=app.setPreference('ta',storage);resolveRead('zh');await Promise.all([restore,first,last]);assert.equal(app.locale(),'ta');assert.deepEqual(writes,['ms','ta']);
});
test('storage failure leaves localization usable and reports failure without clearing sign-in',async()=>{
 const app=core.createLocalization(()=>['ms']);await app.restore({read(){throw Error('storage')},write(){}});assert.equal(app.locale(),'ms');
 await app.setPreference('ta',{read(){},write(){throw Error('storage')}});assert.equal(app.locale(),'ta');assert.equal(app.persistenceError(),true);
 await app.setPreference('zh',memory(null));assert.equal(app.persistenceError(),false);
});
test('four offline catalogues have matching keys and preserve every interpolation placeholder',async()=>{
 const catalogues=await Promise.all(['en','ms','zh','ta'].map(async code=>JSON.parse(await readFile(`student-mobile-expo/src/locales/${code}.json`,'utf8'))));
 const keys=Object.keys(catalogues[0]).sort();assert(keys.length>700);
 const placeholders=text=>(text.match(/\{\{[^}]+\}\}/g)||[]).sort();
 for(const dictionary of catalogues){assert.deepEqual(Object.keys(dictionary).sort(),keys);for(const key of keys){assert.equal(typeof dictionary[key],'string');assert.deepEqual(placeholders(dictionary[key]),placeholders(catalogues[0][key]),key)}}
});
test('dynamic names and reasons survive interpolation, including strings resembling UI keys and nested translation syntax',async()=>{
 const app=core.createLocalization(()=>['en']);
 for(const language of ['en','ms','zh','ta']){
  await app.setPreference(language,memory(null));
  assert.equal(app.t('key intentionally absent'),'key intentionally absent');
  app.instance.addResource('en','translation','fallback_probe','English fallback');assert.equal(app.t('fallback_probe'),'English fallback');
  const data='Eligible $t(Reject) {{reason}} <A> தமிழ்';
  assert(app.t('Manage {{value0}}',{value0:data}).includes(data));
  assert(app.notificationText('Finalised Studies results were finalised by Finalise Lecturer.').includes('Finalised Studies'));
  assert(app.notificationText('Finalised Studies results were finalised by Finalise Lecturer.').includes('Finalise Lecturer'));
  assert(app.notificationText('Your mark for Reject in Eligible has been updated and released.').includes('Reject'));
  assert(app.notificationText('Your mark for Reject in Eligible has been updated and released.').includes('Eligible'));
  assert.equal(app.notificationText('A custom message from a lecturer'),'A custom message from a lecturer');
 }
});
