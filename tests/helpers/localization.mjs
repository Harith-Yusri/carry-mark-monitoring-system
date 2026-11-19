// Existing isolated component harnesses use the real English resources and translator.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const result = await build({entryPoints:['student-mobile-expo/src/localization/core.ts'],bundle:true,write:false,platform:'node',format:'cjs',external:['i18next']});
const module = {exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
export const core = module.exports;
export const locale = core.createLocalization(()=>['en']);
export function localizedFunction(...args) {
 return new Function('t','tx','useLocale','semesterLabel',...args).bind(null,locale.t,locale.tx,()=>locale.locale(),text=>{const m=/^Semester (\d+)(.*)$/.exec(text);return m?locale.t('Semester {{value0}}',{value0:m[1]})+m[2]:text;});
}
