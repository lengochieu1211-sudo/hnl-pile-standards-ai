import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// HNL v1.27 certification count contract.
// Locked production baseline = 574 tests. P4 adds 18 additive shadow tests.
// SPT Excel Golden hardening adds 13 additive parser/geometry/engine/workbook tests.
// P5.2 CPT promotion adds 8 additive CT25-29/table/applicability/export tests.
// Never lower any certified component and never skip tests. Final expected suite = 613/613/0.
const BASELINE_TESTS = 574;
const P4_ADDITIVE_TESTS = 18;
const SPT_GOLDEN_ADDITIVE_TESTS = 13;
const CPT_P5_ADDITIVE_TESTS = 8;
const EXPECTED_TESTS = BASELINE_TESTS + P4_ADDITIVE_TESTS + SPT_GOLDEN_ADDITIVE_TESTS + CPT_P5_ADDITIVE_TESTS;
const root=process.cwd(),maxBuffer=64*1024*1024;
const diagnosticDir=path.join(root,'artifacts','master-audit'),diagnosticFile=path.join(diagnosticDir,'pass83-test-diagnostic.txt');
function spawnNode(args){return spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer,env:process.env});}
function printRun(run){process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');}
function writeDiagnostic({label,args,run,note=''}){mkdirSync(diagnosticDir,{recursive:true});const txt=[`HNL v1.27 · PASS83 EXACT-${EXPECTED_TESTS} DIAGNOSTIC`,`baseline=${BASELINE_TESTS}`,`p4Additive=${P4_ADDITIVE_TESTS}`,`sptGoldenAdditive=${SPT_GOLDEN_ADDITIVE_TESTS}`,`cptP5Additive=${CPT_P5_ADDITIVE_TESTS}`,`label=${label}`,`command=${process.execPath} ${args.join(' ')}`,`status=${String(run?.status)}`,`signal=${String(run?.signal||'')}`,`error=${run?.error?String(run.error.stack||run.error):''}`,note?`note=${note}`:'','','----- STDOUT -----',run?.stdout||'','','----- STDERR -----',run?.stderr||''].filter(x=>x!=='').join('\n');writeFileSync(diagnosticFile,`${txt}\n`,'utf8');return diagnosticFile;}
function runRequired(args,label){const run=spawnNode(args);printRun(run);if(run.error||run.status!==0){const file=writeDiagnostic({label,args,run});console.error(`PASS83 TEST COUNT GATE: ${label} failed; diagnostic=${file}`);process.exit(1);}return run;}
const last=(text,re)=>[...String(text||'').matchAll(re)].at(-1)?.[1];
function tapSummary(run){const text=`${run.stdout||''}\n${run.stderr||''}`;return{tests:Number(last(text,/# tests\s+(\d+)/g)),pass:Number(last(text,/# pass\s+(\d+)/g)),fail:Number(last(text,/# fail\s+(\d+)/g))};}
function isolateFailingFile(testFiles){console.error('PASS83 TEST COUNT GATE: suite failed; isolating test files...');for(const file of testFiles){const args=['--test','--test-concurrency=1',file],run=spawnNode(args),summary=tapSummary(run),ok=!run.error&&run.status===0&&Number.isFinite(summary.tests)&&summary.tests>0&&summary.pass===summary.tests&&summary.fail===0;if(!ok){const diag=writeDiagnostic({label:`isolated:${file}`,args,run,note:`parsed tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}`});console.error(`PASS83 TEST COUNT GATE: FAILING TEST FILE: ${file}; diagnostic=${diag}`);printRun(run);return file;}}return null;}
runRequired(['scripts/generate-image-fixtures.mjs'],'fixtures:images');runRequired(['scripts/check-version-sync.mjs'],'check:version');runRequired(['scripts/check-search-brain.mjs'],'check:search');
const testFiles=readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>path.join('tests',n));if(!testFiles.length){console.error('PASS83 TEST COUNT GATE: no tests/*.test.mjs files found');process.exit(1);}
const args=['--test','--test-concurrency=1',...testFiles],run=spawnNode(args),summary=tapSummary(run);
if(run.error||run.status!==0){const diag=writeDiagnostic({label:`node:test exact-${EXPECTED_TESTS} suite`,args,run,note:`parsed tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}`});console.error(`PASS83 TEST COUNT GATE: deterministic suite failed; diagnostic=${diag}`);isolateFailingFile(testFiles);process.exit(1);}printRun(run);
if(summary.tests!==EXPECTED_TESTS||summary.pass!==EXPECTED_TESTS||summary.fail!==0){const diag=writeDiagnostic({label:'exact-count-mismatch',args,run,note:`expected ${EXPECTED_TESTS}/${EXPECTED_TESTS}/0; got tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}`});console.error(`PASS83 TEST COUNT GATE: FAIL tests=${summary.tests} pass=${summary.pass} fail=${summary.fail}; diagnostic=${diag}`);process.exit(1);}
console.log(`PASS83 TEST COUNT GATE: PASS ${EXPECTED_TESTS}/${EXPECTED_TESTS}, fail 0 · baseline ${BASELINE_TESTS} + P4 ${P4_ADDITIVE_TESTS} + SPT Golden ${SPT_GOLDEN_ADDITIVE_TESTS} + CPT P5 ${CPT_P5_ADDITIVE_TESTS}`);
