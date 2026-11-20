// Existing isolated component harnesses use the real English resources and translator.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const result = await build({entryPoints:['student-mobile-expo/src/localization/core.ts'],bundle:true,write:false,platform:'node',format:'cjs',external:['i18next']});
const module = {exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
export const core = module.exports;
const termResult = await build({entryPoints:['student-mobile-expo/src/academic/terms.ts'],bundle:true,write:false,platform:'node',format:'cjs'});
const termModule = {exports:{}};new Function('module','exports',termResult.outputFiles[0].text)(termModule,termModule.exports);
export const academicTerms = termModule.exports;
export const locale = core.createLocalization(()=>['en']);
export function localizedFunction(...args) {
 const compiled = new Function('t','tx','useLocale','semesterLabel',...args).bind(null,locale.t,locale.tx,()=>locale.locale(),text=>{const m=/^Semester (\d+)(.*)$/.exec(text);return m?locale.t('Semester {{value0}}',{value0:m[1]})+m[2]:text;});
 return (...values)=>compiled(...values.map((value,index)=>args[index]==='require' ? name=>name.includes('/academic/terms')?academicTerms:value(name) : value));
}
