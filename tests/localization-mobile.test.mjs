import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import React from 'react';
import { core } from './helpers/localization.mjs';
const app=core.createLocalization(()=>['en']);const memory={read:()=>null,write(){}};
const styles={create:value=>value,hairlineWidth:1};
async function compile(file,dependencies={}){
 const {code}=await transform((await readFile(file,'utf8')).replace(/^import[\s\S]*?;\n/gm,''),{loader:file.endsWith('tsx')?'tsx':'ts',format:'cjs',jsx:'transform'});
 const defaults={React,Platform:{OS:"android"},Keyboard:{dismiss(){}},Alert:{alert(){}},t:app.t,tx:app.tx,notificationText:app.notificationText,useLocale:()=>app.locale(),semesterLabel:text=>text.replace(/^Semester (\d+)/,(_,n)=>app.t('Semester {{value0}}',{value0:n})),useState:v=>[typeof v==='function'?v():v,()=>{}],useEffect(){},useFocusEffect(){},useCallback:f=>f,useMemo:f=>f(),useRef:v=>({current:v}),StyleSheet:styles,typography:{body:{},bodyStrong:{}},fonts:{},...dependencies};
 return new Function(...Object.keys(defaults),'module',code+';return module.exports;')(...Object.values(defaults),{exports:{}});
}
const palette=await compile('student-mobile-expo/src/theme/colors.ts');const {getGlassStyle}=await compile('student-mobile-expo/src/theme/glass.ts');
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
const text=tree=>nodes(tree).flatMap(n=>React.Children.toArray(n.props?.children).filter(x=>typeof x==='string'||typeof x==='number')).join(' ');
const nativeNames=['View','Text','ScrollView','Modal','Pressable','Switch','Image','FlatList','KeyboardAvoidingView','RefreshControl','SafeAreaView','ActivityIndicator','TextInput','Card','Heading','Screen','Field','PrimaryButton','ButtonText','ErrorBanner','StudentAvatar','SubjectCard','SubjectBarChart','LoadingView','Redirect','Bell','BellRing','BookOpen','Plus','X','AlertCircle','BarChart3','CheckCircle2','Clock3','LockKeyhole','Building2','CalendarDays','GraduationCap','Hash','LogOut','Moon','Smartphone','Check','ChevronDown','Mail','UserRound','ClipboardCheck','FilePenLine','FileText','FolderOpen','MessageCircle','MessageSquareWarning','Presentation','UsersRound','ChevronLeft','Svg','Defs','RadialGradient','Rect','Stop'];
const subject={offering_id:'exact',code:'CAMS101',name:'Eligible',group:'Rejected',lecturer:'Correct Mark',is_finalised:true,eligible:true,carry_mark:41.5,carry_maximum:50,eligible_threshold:40,assessments:[{name:'Release Marks',assessment_type:'Quiz',score:83,maximum:100,weight:50}]};
const student={name:'My Subjects',matrix_number:'STUDENT1',semester:'Semester 4',programme:'Report Mark Issue',faculty:'Settings',semester_code:'20271'};
test('active mobile screens render four locales in both themes without changing database names or marks',async()=>{
 for(const lang of ['en','ms','zh','ta'])for(const mode of ['light','dark']){
  await app.setPreference(lang,memory);const colors=mode==='light'?palette.lightPalette:palette.darkPalette;
  const dependencies=Object.fromEntries(nativeNames.map(n=>[n,n]));Object.assign(dependencies,{getSubjectColors:()=>({}),getGlassStyle,useWindowDimensions:()=>({width:320,fontScale:1.6}),useLocalSearchParams:()=>({offeringId:'exact'}),useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0}),useTheme:()=>({colors,mode,toggle(){}}),useStudent:()=>({student,subjects:[subject],notifications:[],error:null,refresh(){},notifications_enabled:true}),Constants:{expoConfig:{version:'1.0.0'}},LanguageSetting:'LanguageSetting',router:{back(){},push(){}},loadAssignedLecturerWhatsApp(){throw Error('Unexpected contact read')}});
  for(const [file,title] of [['src/app/(tabs)/index.tsx','My Subjects'],['src/app/(tabs)/progress.tsx','My Progress'],['src/app/(tabs)/settings.tsx','Settings'],['src/app/subject/[offeringId].tsx','Assessments']]){
   const module=await compile('student-mobile-expo/'+file,dependencies);const tree=module.default();const output=text(tree);
   // FlatList renders its header/items natively; inspect supplied element props too.
   const rendered=file.endsWith('/index.tsx')?text(nodes(tree).find(n=>n.type==="FlatList").props.ListHeaderComponent):output;
   if(title!=='Settings')assert(rendered.includes(app.t(title)),`${lang} ${file}`);
   assert(!rendered.includes('[object Object]'));assert(!rendered.includes('undefined'));
   if(file.includes('/subject/')){for(const value of ['Eligible','Correct Mark','Rejected','Release Marks','42','83'])assert(output.includes(value),value);assert.deepEqual(subject.assessments[0],{name:'Release Marks',assessment_type:'Quiz',score:83,maximum:100,weight:50})}
   if(title==='Settings'){assert(nodes(tree).some(n=>n.type==='LanguageSetting'));assert(output.includes('Report Mark Issue'));assert(output.includes('My Subjects'))}
  }
 }
});
test('mobile language menu offers all choices and saves a selected language immediately',async()=>{
 const choices=[];const {LanguageSetting}=await compile('student-mobile-expo/src/localization/LanguageSetting.tsx',{...Object.fromEntries(nativeNames.map(n=>[n,n])),useTheme:()=>({colors:palette.darkPalette}),languages:core.languages,localization:app,setLanguage:value=>{choices.push(value);return app.setPreference(value,memory)}});
 const tree=LanguageSetting();const radios=nodes(tree).filter(n=>n.props.accessibilityRole==='radio');assert.equal(radios.length,5);
 for(const [i,value] of core.languages.entries()){radios[i].props.onPress();assert.equal(app.preference(),value.value)}assert.deepEqual(choices,['auto','en','ms','zh','ta']);
});
test('native adapter restores/writes only the language SecureStore key and detects on foreground without an auth call',async()=>{
 const {code}=await transform(await readFile('student-mobile-expo/src/localization/react.tsx','utf8'),{loader:'tsx',format:'cjs'});
 let saved='ms',onActive;const writes=[];
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>{
  if(name==='react')return {useSyncExternalStore(){}};
  if(name==='react-native')return {Platform:{OS:'android'},AppState:{addEventListener:(_event,callback)=>{onActive=callback}}};
  if(name==='expo-secure-store')return {getItemAsync:async key=>{assert.equal(key,core.LANGUAGE_KEY);return saved},setItemAsync:async(key,value)=>{writes.push([key,value]);saved=value}};
  if(name==='./core')return {...core,deviceLanguages:()=>['ta-MY']};throw Error('Unexpected dependency '+name);
 },module,module.exports);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(module.exports.localization.locale(),'ms');await module.exports.setLanguage('zh');onActive('active');assert.equal(module.exports.localization.locale(),'zh');await module.exports.setLanguage('auto');assert.equal(module.exports.localization.locale(),'ta');assert.deepEqual(writes,[[core.LANGUAGE_KEY,'zh'],[core.LANGUAGE_KEY,'auto']]);
});
test('student report UI translates statuses while retaining issue descriptions, responses and assessment names',async()=>{
 const {markIssueStatus}=await compile('student-mobile-expo/src/services/markIssues.ts');
 const workspace={request_key:'key',options:[{enrolment_id:'student',assessment_id:'assessment',name:'Correct Mark',class_label:'Submitted'}],issues:[{id:'issue',assessment_name:'Release Marks',class_label:'Eligible',status:'rejected',created_at:'2026-11-01T00:00:00Z',explanation:'My Subjects $t(Reject)',response:'Correct Mark {{value0}}'}]};
 for(const lang of ['en','ms','zh','ta']){
  await app.setPreference(lang,memory);let cursor=0;
  const dependencies={...Object.fromEntries(nativeNames.map(n=>[n,n])),getGlassStyle,markIssueStatus,useLocalSearchParams:()=>({offeringId:'exact'}),useTheme:()=>({colors:palette.lightPalette}),useStudent:()=>({student,subjects:[subject]}),useState:initial=>[cursor++===2?workspace:initial,()=>{}]};
  const module=await compile('student-mobile-expo/src/app/dispute/[offeringId].tsx',dependencies);const form=module.default();const output=text(form.type(form.props));assert(output.includes(app.t('Report a mark issue')));assert(output.includes(app.t('Rejected')));
  for(const raw of ['Release Marks','Correct Mark','My Subjects $t(Reject)','Correct Mark {{value0}}'])assert(output.includes(raw));
 }
});
