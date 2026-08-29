#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const sourcePath='src/excel-export.js';
const gatePath='tools/pass83-source-sync-gate.mjs';
const mode=process.argv.includes('--refresh-lock')?'refresh-lock':'apply';

function count(text,needle){ return text.split(needle).length-1; }

if(mode==='apply'){
  let source=fs.readFileSync(sourcePath,'utf8');
  const replacements=[
    {from:"'README'",to:"'00_HUONG_DAN'",expected:4,label:'README sheet'},
    {from:"'INPUT'",to:"'01_DAU_VAO'",expected:32,label:'INPUT sheet/ref'},
    {from:"'SOURCE'",to:"'98_NGUON'",expected:1,label:'SOURCE sheet'}
  ];
  for(const item of replacements){
    const before=count(source,item.from);
    const afterExisting=count(source,item.to);
    if(before===item.expected){
      source=source.split(item.from).join(item.to);
      console.log(`PATCH ${item.label}: ${before} occurrence(s)`);
    } else if(before===0 && afterExisting>=item.expected){
      console.log(`ALREADY PATCHED ${item.label}: ${afterExisting} replacement occurrence(s)`);
    } else {
      throw new Error(`Unexpected ${item.label} count: old=${before}, new=${afterExisting}, expected old=${item.expected}`);
    }
  }
  const sheetNames=[...source.matchAll(/addWorksheet\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>m[1]);
  const englishTokens=/\b(INPUT|CALC|LOOKUP|SOURCE|RESULT|GUIDE|README|PROFILE|POINTS|SHAFT|TIP|SUMMARY)\b/i;
  const remaining=[...new Set(sheetNames.filter(name=>englishTokens.test(name)))];
  if(remaining.length) throw new Error(`English user-facing sheet names remain: ${remaining.join(', ')}`);
  fs.writeFileSync(sourcePath,source);
  console.log('EXCEL P1 SHEET LANGUAGE PATCH: APPLIED');
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
