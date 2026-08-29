#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=path.join(root,'RELEASE_SYNC_MANIFEST.json');
const fail=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hash=p=>crypto.createHash('sha256').update(read(p).replace(/\r\n/g,'\n')).digest('hex');
if(!fs.existsSync(manifestPath)) fail.push('Thiếu RELEASE_SYNC_MANIFEST.json');
let m={};
if(!fail.length){try{m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));}catch(e){fail.push(`Manifest JSON lỗi: ${e.message}`);}}
let pkg={},meta={};
try{pkg=JSON.parse(read('package.json'));meta=JSON.parse(read('public/release-meta.json'));}catch(e){fail.push(`Không đọc được version metadata: ${e.message}`);}
const version=String(pkg.version||'');
if(!/^\d+\.\d+\.\d+$/.test(version)) fail.push(`package.json version không hợp lệ: ${version}`);
if(String(meta.appVersion)!==version) fail.push(`release-meta appVersion=${meta.appVersion}, package=${version}`);
if(String(m.appVersion)!==version) fail.push(`manifest appVersion=${m.appVersion}, package=${version}`);
if('engineeringRelease' in meta) fail.push('release-meta còn engineeringRelease song song');
if(String(meta.certificationStage)!=='MASTER_SYSTEM_AUDIT'||String(m.certificationStage)!=='MASTER_SYSTEM_AUDIT') fail.push('certificationStage lệch MASTER_SYSTEM_AUDIT');
if(String(meta.goldenBaseline)!=='1.25.7'||String(m.goldenBaseline)!=='1.25.7') fail.push('goldenBaseline lệch 1.25.7');
if(String(meta.searchBrain)!=='1.9.23'||String(meta.searchBrainStatus)!=='LOCKED'||String(m.searchBrain)!=='1.9.23 LOCKED') fail.push('Search Brain identity lệch');
for(const [file,want] of Object.entries(m.files||{})){const abs=path.join(root,file);if(!fs.existsSync(abs)){fail.push(`MISSING ${file}`);continue;}const got=hash(file);if(got!==want)fail.push(`HASH ${file} got=${got} want=${want}`);}
if(fail.length){for(const x of fail)console.error(`FAIL ${x}`);console.error(`RELEASE SYNC GATE: FAIL (${fail.length})`);process.exit(1);}
console.log(`RELEASE SYNC GATE: PASS · HNL v${version} · ${meta.certificationStage} · Golden ${meta.goldenBaseline} · Search Brain ${meta.searchBrain} LOCKED`);
