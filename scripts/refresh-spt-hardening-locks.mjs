#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const releasePath='RELEASE_SYNC_MANIFEST.json';
const fullPath='FULL_OVERWRITE_MANIFEST.json';
const pass83Path='tools/pass83-source-sync-gate.mjs';
const permanent=[
  '.github/workflows/spt-excel-golden-hardening.yml',
  'scripts/spt-excel-com-golden.ps1',
  'scripts/spt-excel-golden-generate.mjs',
  'scripts/spt-spreadsheet-runtime-golden.mjs',
  'src/engineering-input-interpreter.js',
  'src/engineering-router.js',
  'src/excel-export-compat.js',
  'src/excel-export.js',
  'src/pile-geometry-engine.js',
  'src/pile-workflows.js',
  'src/spt-shared-spec.js',
  'tests/spt-excel-golden-hardening.test.mjs',
  'tests/spt-excel-parity-provenance.test.mjs'
];
const pass83Locked=[
  'src/codepack-tables.js','src/tcvn10304-table-engine.js','src/pile-workflows.js','src/excel-export.js','src/main.js',
  'tests/v1.25.6.test.mjs','src/search.js','src/pdf.js','src/ai.js',
  'src/pile-geometry-engine.js','src/engineering-input-interpreter.js','src/engineering-router.js','src/spt-shared-spec.js'
];
const assertFile=p=>{if(!fs.existsSync(p))throw new Error(`Missing required file ${p}`)};
const hashRaw=p=>{assertFile(p);return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')};
const hashNormalized=p=>{assertFile(p);return crypto.createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')};
const writeJson=(p,obj)=>fs.writeFileSync(p,JSON.stringify(obj,null,2)+'\n');

for(const p of permanent) assertFile(p);

// Pass 8.3 source lock uses raw file bytes, matching tools/pass83-source-sync-gate.mjs.
let pass83=fs.readFileSync(pass83Path,'utf8');
const start=pass83.indexOf('const expected = {');
const end=pass83.indexOf('\n};',start);
if(start<0||end<0) throw new Error('Cannot locate pass83 expected map');
const mapLines=pass83Locked.map(p=>`  '${p}':'${hashRaw(p)}'`).join(',\n');
pass83=pass83.slice(0,start)+`const expected = {\n${mapLines}\n`+pass83.slice(end);
fs.writeFileSync(pass83Path,pass83);

// Release-sync gate normalizes CRLF before hashing; use the exact same rule.
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
release.files=release.files||{};
for(const p of permanent) release.files[p]=hashNormalized(p);
release.files[pass83Path]=hashNormalized(pass83Path);
writeJson(releasePath,release);

// Full-overwrite manifest is delivery inventory; refresh all touched permanent files and the lock files themselves.
const full=JSON.parse(fs.readFileSync(fullPath,'utf8'));
full.files=full.files||{};
for(const p of permanent) full.files[p]=hashNormalized(p);
full.files[pass83Path]=hashNormalized(pass83Path);
full.files[releasePath]=hashNormalized(releasePath);
full.fileCount=Object.keys(full.files).length;
writeJson(fullPath,full);

console.log(`SPT HARDENING LOCK REFRESH: PASS · release=${Object.keys(release.files).length} · full=${full.fileCount} · pass83=${pass83Locked.length}`);
