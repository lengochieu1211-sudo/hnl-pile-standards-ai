import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function ok(name,pass,detail){return {name,status:pass?'PASS':'FAIL',detail};}
const upstream=read('artifacts/P1_PASS5_CORE_LOCKED_RELEASE_MANIFEST_V16.json');
const golden=read('artifacts/p1-pass6-e2e-golden-v17.json');
const tests=spawnSync('node',['--test','tests/*.test.mjs'],{shell:true,encoding:'utf8'});
const m=tests.stdout.match(/# tests (\d+)[\s\S]*# pass (\d+)[\s\S]*# fail (\d+)/);
const ts=m?{tests:+m[1],pass:+m[2],fail:+m[3],exitCode:tests.status??1}:{tests:null,pass:null,fail:null,exitCode:tests.status??1};
const checks=[];
for(const f of ['src/etabs-sap-importer.js','src/csi-live-bridge.js','src/pass5-core-status.js','src/pile-reaction-engine.js']){
 checks.push(ok(`UPSTREAM_HASH_${f}`,sha(f)===upstream.keyFileSha256[f],{actual:sha(f),expected:upstream.keyFileSha256[f]}));
}
checks.push(ok('CURRENT_TESTS',ts.exitCode===0&&ts.fail===0&&ts.tests>=148&&ts.pass===ts.tests,ts));
checks.push(ok('GOLDEN_OVERALL',golden.pass===true,golden.expected));
checks.push(ok('DCE_CSV_PARITY_19',golden.sourceParity?.rows===19&&golden.sourceParity?.pass===19&&golden.sourceParity?.fail===0,golden.sourceParity));
checks.push(ok('GOVERNING_168',golden.dceResult?.governing?.pileId==='168'&&golden.dceResult?.governing?.combinationId==='EULS'&&Math.abs(golden.dceResult?.governing?.utilization-0.4980692764464232)<1e-12,golden.dceResult?.governing));
checks.push(ok('CAPACITY_LOCKED',/^LOCKED/.test(golden.capacity?.status)&&Math.abs(golden.capacity?.NdMaxPerPileKn-733.4161490683232)<1e-9,golden.capacity));
checks.push(ok('SAFETY_BLOCKS',Object.values(golden.safety??{}).every(Boolean),golden.safety));
checks.push(ok('PRIOR_REGRESSION',upstream.golden?.priorRegression==='388/388 PASS',upstream.golden));
checks.push(ok('PRIOR_FULL_TABLE',upstream.golden?.priorFullTable==='1242/1242 PASS',upstream.golden));
checks.push(ok('SEARCH_BRAIN_PRIOR_LOCK',upstream.golden?.searchBrainSha256==='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2',upstream.golden?.searchBrainSha256));
const failed=checks.filter(x=>x.status!=='PASS');
const result={schema:'HNL-P1-PASS6-E2E-LOCK-GATE',version:'1.25.7',generatedAt:new Date().toISOString(),checks,pass:failed.length===0,failed:failed.map(x=>x.name),status:failed.length?'REVIEW_BLOCKED':'CORE_LOCKED_PATCH',fullSourceIntegration:'DEFERRED_SEPARATE_GATE',liveCsiCertification:'DEFERRED'};
fs.writeFileSync('artifacts/P1_PASS6_E2E_LOCK_GATE_V17.json',JSON.stringify(result,null,2));
fs.writeFileSync('artifacts/p1-pass6-lock-gate-v17.log',tests.stdout+'\n'+tests.stderr+'\n'+JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(failed.length) process.exitCode=2;
