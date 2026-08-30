#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

await import('./repair-excel-p1-dropdown-v2.mjs');

const manifestPath='RELEASE_SYNC_MANIFEST.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const searchHash='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';
if(manifest.appVersion!=='1.26.0') throw new Error(`Unexpected appVersion ${manifest.appVersion}`);
if(manifest.certificationStage!=='MASTER_SYSTEM_AUDIT') throw new Error(`Unexpected certificationStage ${manifest.certificationStage}`);
if(manifest.goldenBaseline!=='1.25.7') throw new Error(`Unexpected goldenBaseline ${manifest.goldenBaseline}`);
if(manifest.searchBrain!=='1.9.23 LOCKED') throw new Error(`Unexpected manifest Search Brain ${manifest.searchBrain}`);
const pass83=fs.readFileSync('tools/pass83-source-sync-gate.mjs','utf8');
if(!pass83.includes(`'src/search.js':'${searchHash}'`)) throw new Error('Search Brain source-sync hash changed');

function normalizedSha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex');
}
for(const file of ['src/excel-export-compat.js','scripts/master-system-audit.mjs','scripts/excel-production-smoke.mjs']){
  if(!manifest.files?.[file]) throw new Error(`Missing manifest.files entry ${file}`);
  const before=manifest.files[file];
  const after=normalizedSha256(file);
  manifest.files[file]=after;
  console.log(`${file}: ${before} -> ${after}`);
}
if(manifest.searchBrain!=='1.9.23 LOCKED') throw new Error('Search Brain identity mutated');
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('EXCEL P1 DROPDOWN V4: PATCH + MANIFEST.FILES REFRESH APPLIED');
