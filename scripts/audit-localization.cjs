// Audit reachable CAMS JSX. Brand names and the CSV format acronym stay literal.
const fs=require('node:fs'),path=require('node:path');
const ts=require('../student-mobile-expo/node_modules/typescript');
const roots=['src/app','src/features','src/layouts','src/components','student-mobile-expo/src/app','student-mobile-expo/src/components'];
const allowed=new Set(['CAMS','UiTM','CSV']);const findings=[];let files=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.tsx')&&!file.includes('/app/components/')&&!file.endsWith('WhatsAppReminderButton.tsx'))audit(file)}}
function audit(file){files++;const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function report(node){findings.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1} ${node.getText(source).trim()}`)}
 function visit(node){if(ts.isJsxText(node)&&/[A-Za-z]{2}/.test(node.text)&&!allowed.has(node.text.trim()))report(node);if(ts.isJsxAttribute(node)&&node.initializer&&ts.isStringLiteral(node.initializer)&&/^(title|label|placeholder|aria-label|accessibilityLabel|description)$/.test(node.name.text)&&/[A-Za-z]{2}/.test(node.initializer.text)&&!allowed.has(node.initializer.text.trim()))report(node);ts.forEachChild(node,visit)}visit(source)}
roots.forEach(walk);if(findings.length){console.error(findings.join('\n'));process.exitCode=1}else console.log(`Audited ${files} active UI files: no untranslated literal JSX copy or text attributes beyond CAMS/UiTM/CSV.`);
