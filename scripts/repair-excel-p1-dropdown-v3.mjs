#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

// Reuse the already-functional v2 workspace patch, then refresh only the
// release-sync hashes for files intentionally changed by that repair.
await import('./repair-excel-p1-dropdown-v2.mjs');

const manifestPath='RELEASE_SYNC_MANIFEST.json';
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const expectedSearch='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';
if(manifest.appVersion!=='1.26.0') throw new Error(`Unexpected appVersion ${manifest.appVersion}`);
if(manifest.goldenBaseline!=='1.25.7') throw new Error(`Unexpected goldenBaseline ${manifest.goldenBaseline}`);
if(manifest.searchBrain!=='1.9.23'||manifest.searchBrainStatus!=='LOCKED') throw new Error('Search Brain release identity changed');
if(manifest.criticalHashes?.['src/search.js']!==expectedSearch) throw new Error('Search Brain manifest hash changed');

function normalizedSha256(file){
  const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  return crypto.createHash('sha256').update(text).digest('hex');
}
const files=['src/excel-export-compat.js','scripts/master-system-audit.mjs','scripts/excel-production-smoke.mjs'];
for(const file of files){
  const before=manifest.criticalHashes[file];
  const after=normalizedSha256(file);
  if(!before) throw new Error(`Missing critical hash key ${file}`);
  manifest.criticalHashes[file]=after;
  console.log(`${file}: ${before} -> ${after}`);
}
if(manifest.criticalHashes['src/search.js']!==expectedSearch) throw new Error('Search Brain hash mutated during refresh');
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('EXCEL P1 DROPDOWN V3: PATCH + RELEASE SYNC HASH REFRESH APPLIED');
