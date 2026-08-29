#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const sourcePath='src/excel-export.js';
const runtimeSmokePath='scripts/excel-runtime-smoke.mjs';
const excelComPath='scripts/verify-excel-com.ps1';
const gatePath='tools/pass83-source-sync-gate.mjs';
const mode=process.argv.includes('--refresh-lock')?'refresh-lock':'apply';

function count(text,needle){ return text.split(needle).length-1; }
function replaceExact(text,{from,to,expected=1,label}){
  const before=count(text,from);
  const afterExisting=count(text,to);
  if(before===expected){
    console.log(`PATCH ${label}: ${before} occurrence(s)`);
    return text.split(from).join(to);
  }
  if(before===0 && afterExisting>=expected){
    console.log(`ALREADY PATCHED ${label}: ${afterExisting} replacement occurrence(s)`);
    return text;
  }
  throw new Error(`Unexpected ${label} count: old=${before}, new=${afterExisting}, expected old=${expected}`);
}

if(mode==='apply'){
  let source=fs.readFileSync(sourcePath,'utf8');
  for(const item of [
    {from:"'README'",to:"'00_HUONG_DAN'",expected:4,label:'README sheet'},
    {from:"'INPUT'",to:"'01_DAU_VAO'",expected:32,label:'INPUT sheet/ref'},
    {from:"'SOURCE'",to:"'98_NGUON'",expected:1,label:'SOURCE sheet'}
  ]) source=replaceExact(source,item);

  const sheetNames=[...source.matchAll(/addWorksheet\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>m[1]);
  const englishTokens=/\b(INPUT|CALC|LOOKUP|SOURCE|RESULT|GUIDE|README|PROFILE|POINTS|SHAFT|TIP|SUMMARY)\b/i;
  const remaining=[...new Set(sheetNames.filter(name=>englishTokens.test(name)))];
  if(remaining.length) throw new Error(`English user-facing sheet names remain: ${remaining.join(', ')}`);
  fs.writeFileSync(sourcePath,source);

  let smoke=fs.readFileSync(runtimeSmokePath,'utf8');
  const smokeReplacements=[
    {from:"required:['README','INPUT','LOOKUP_BANG1','CALC_ROCK','SOURCE']",to:"required:['00_HUONG_DAN','01_DAU_VAO','LOOKUP_BANG1','CALC_ROCK','98_NGUON']",label:'runtime rock required sheets'},
    {from:"inputRef:/INPUT|LOOKUP_BANG1/",to:"inputRef:/01_DAU_VAO|LOOKUP_BANG1/",label:'runtime rock input refs'},
    {from:"required:['README','INPUT','SOIL_PROFILE','LOOKUP_BANG3_6','LOOKUP_MUI','SHAFT_SEGMENTS','CALC_TIP_RK_RD','SOURCE']",to:"required:['00_HUONG_DAN','01_DAU_VAO','SOIL_PROFILE','LOOKUP_BANG3_6','LOOKUP_MUI','SHAFT_SEGMENTS','CALC_TIP_RK_RD','98_NGUON']",label:'runtime bored required sheets'},
    {from:"inputRef:/INPUT|SOIL_PROFILE|LOOKUP_BANG3_6|LOOKUP_MUI/",to:"inputRef:/01_DAU_VAO|SOIL_PROFILE|LOOKUP_BANG3_6|LOOKUP_MUI/",label:'runtime bored input refs'},
    {from:"required:['README','INPUT','SOIL_PROFILE','SPT_POINTS','LOOKUP_D1','CALC_TIP','CALC_SHAFT','CALC_RK_RD','SOURCE']",to:"required:['00_HUONG_DAN','01_DAU_VAO','SOIL_PROFILE','SPT_POINTS','LOOKUP_D1','CALC_TIP','CALC_SHAFT','CALC_RK_RD','98_NGUON']",label:'runtime SPT required sheets'},
    {from:"inputRef:/INPUT|SOIL_PROFILE|SPT_POINTS|LOOKUP_D1/",to:"inputRef:/01_DAU_VAO|SOIL_PROFILE|SPT_POINTS|LOOKUP_D1/",label:'runtime SPT input refs'},
    {from:"required:['README','INPUT','LOOKUP_BANG1','CALC_ROCK','SOURCE','MATERIAL_INPUT','MATERIAL_LOOKUP','MATERIAL_CALC','PILE_GOVERNING','E2E_SOURCE']",to:"required:['00_HUONG_DAN','01_DAU_VAO','LOOKUP_BANG1','CALC_ROCK','98_NGUON','MATERIAL_INPUT','MATERIAL_LOOKUP','MATERIAL_CALC','PILE_GOVERNING','E2E_SOURCE']",label:'runtime E2E required sheets'},
    {from:"inputRef:/INPUT|LOOKUP_BANG1|MATERIAL_INPUT/",to:"inputRef:/01_DAU_VAO|LOOKUP_BANG1|MATERIAL_INPUT/",label:'runtime E2E input refs'},
    {from:"required:['README','BATCH_INPUT','BOREHOLE_BATCH','BATCH_SOURCE']",to:"required:['00_HUONG_DAN','BATCH_INPUT','BOREHOLE_BATCH','BATCH_SOURCE']",label:'runtime multiborehole required sheets'}
  ];
  for(const item of smokeReplacements) smoke=replaceExact(smoke,item);
  if(/required:\[[^\n]*['"](?:README|INPUT|SOURCE)['"]/.test(smoke)) throw new Error('Old English sheet contract remains in Excel runtime smoke.');
  fs.writeFileSync(runtimeSmokePath,smoke);

  let com=fs.readFileSync(excelComPath,'utf8');
  com=replaceExact(com,{from:'$inp=$wb.Worksheets.Item("INPUT")',to:'$inp=$wb.Worksheets.Item("01_DAU_VAO")',label:'Windows COM rock input sheet'});
  if(com.includes('Worksheets.Item("INPUT")')) throw new Error('Old INPUT sheet contract remains in Windows Excel COM verification.');
  fs.writeFileSync(excelComPath,com);

  console.log('EXCEL P1 SHEET LANGUAGE + CERTIFICATION CONTRACT PATCH: APPLIED');
  process.exit(0);
}

const source=fs.readFileSync(sourcePath);
const newHash=crypto.createHash('sha256').update(source).digest('hex');
let gate=fs.readFileSync(gatePath,'utf8');
const re=/'src\/excel-export\.js':'[0-9a-f]{64}'/;
if(!re.test(gate)) throw new Error('Cannot locate excel-export source lock in pass83 gate.');
const searchLock=gate.match(/'src\/search\.js':'([0-9a-f]{64})'/)?.[1]||'';
const expectedSearch='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';
if(searchLock!==expectedSearch) throw new Error(`Search Brain lock changed unexpectedly: ${searchLock}`);
gate=gate.replace(re,`'src/excel-export.js':'${newHash}'`);
fs.writeFileSync(gatePath,gate);
console.log(`PASS83 excel-export lock refreshed to ${newHash}`);
console.log(`Search Brain lock preserved ${expectedSearch}`);
