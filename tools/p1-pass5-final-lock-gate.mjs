import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const LOCKED_SEARCH_BRAIN_SHA256='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';

function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function shaNormalizedFile(p){
  let text=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  return crypto.createHash('sha256').update(text,'utf8').digest('hex');
}
function parseNodeTestSummary(stdout){
  const n=(name)=>{const m=stdout.match(new RegExp(`# ${name} (\\d+)`));return m?Number(m[1]):null;};
  return {tests:n('tests'),pass:n('pass'),fail:n('fail')};
}
function pass(name,ok,detail){return {name,status:ok?'PASS':'FAIL',detail};}

export function evaluateFinalLock({
  liveGolden,
  priorGate,
  actualSearchHash,
  nodeTests={status:0,tests:0,pass:0,fail:0},
  mode='live'
}){
  const checks=[];
  checks.push(pass('LIVE_GOLDEN_MODE', mode==='live', {mode}));
  checks.push(pass('LIVE_GOLDEN_PASS', liveGolden?.pass===true, liveGolden?.issues??[]));
  checks.push(pass('LIVE_EXACT_COVERAGE',
    liveGolden?.checked?.coordinates===194 &&
    liveGolden?.checked?.nodalEnvelopes===19 &&
    liveGolden?.checked?.pierForces===234 &&
    Object.values(liveGolden?.coverage??{}).every(Boolean),
    {checked:liveGolden?.checked,coverage:liveGolden?.coverage}
  ));
  checks.push(pass('LIVE_DIRECT_TABLE_COORD',
    liveGolden?.live?.directVsTableCoordinates?.status==='PASS' &&
    liveGolden?.live?.directVsTableCoordinates?.matches===true &&
    liveGolden?.live?.directVsTableCoordinates?.checked===194,
    liveGolden?.live?.directVsTableCoordinates
  ));
  checks.push(pass('LIVE_DIRECT_TABLE_REACTION',
    liveGolden?.live?.directVsTableReactions?.status==='PASS' &&
    liveGolden?.live?.directVsTableReactions?.matches===true &&
    liveGolden?.live?.directVsTableReactions?.checkedGroups===19,
    liveGolden?.live?.directVsTableReactions
  ));
  checks.push(pass('LIVE_UNIT_PROFILE',
    liveGolden?.live?.units?.normalizedTo==='kN_m_C' && liveGolden?.live?.units?.verified===true,
    liveGolden?.live?.units
  ));
  checks.push(pass('LIVE_UNIT_RESTORE',
    liveGolden?.live?.unitRestore?.restored===true,
    liveGolden?.live?.unitRestore
  ));
  checks.push(pass('NODE_CURRENT_REGRESSION',
    nodeTests.status===0 && nodeTests.fail===0 && nodeTests.tests>=126 && nodeTests.pass===nodeTests.tests,
    nodeTests
  ));

  const p=priorGate?.pureNode??{};
  checks.push(pass('PRIOR_REGRESSION_388',p.regression?.status==='PASS'&&p.regression?.passed===388&&p.regression?.failed===0,p.regression));
  checks.push(pass('PRIOR_FULL_TABLE_1242',p.fullTableGolden?.status==='PASS'&&p.fullTableGolden?.passed===1242&&p.fullTableGolden?.failed===0,p.fullTableGolden));
  checks.push(pass('PRIOR_PILE_QUANTITY',p.pileQuantity?.status==='PASS'&&p.pileQuantity?.xlsmRows==='39/39'&&p.pileQuantity?.xlsmChecks==='273/273',p.pileQuantity));
  checks.push(pass('PRIOR_SEARCH_GATE',p.searchBrain?.status==='PASS'&&p.searchBrain?.sha256===LOCKED_SEARCH_BRAIN_SHA256,p.searchBrain));
  checks.push(pass('ACTUAL_SEARCH_FILE_HASH',actualSearchHash===LOCKED_SEARCH_BRAIN_SHA256,{actualSearchHash,expected:LOCKED_SEARCH_BRAIN_SHA256}));

  const failed=checks.filter(x=>x.status!=='PASS');
  return {
    schema:'HNL-P1-PASS5-FINAL-LOCK-GATE',
    version:'1.25.7',
    generatedAt:new Date().toISOString(),
    mode,
    checks,
    pass:failed.length===0,
    failed:failed.map(x=>x.name),
    lockStatus:failed.length===0?'P1_PASS5_LOCKED':'P1_PASS5_BLOCKED'
  };
}

function arg(name,def=null){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:def;}
if(import.meta.url===`file://${process.argv[1].replace(/\\/g,'/')}` || process.argv[1]?.endsWith('p1-pass5-final-lock-gate.mjs')){
  const livePath=arg('--live-golden');
  const gatePath=arg('--gate-status');
  const searchFile=arg('--search-file');
  const outDir=arg('--out-dir','.');
  const mode=arg('--mode','live');
  const searchOverride=arg('--search-hash-override');
  if(!livePath||!gatePath) throw new Error('--live-golden and --gate-status are required');
  if(mode==='live'&&!searchFile) throw new Error('--search-file is mandatory in live mode');
  if(mode==='live'&&searchOverride) throw new Error('--search-hash-override is forbidden in live mode');

  const testRun=spawnSync(process.execPath,['--test','tests/*.test.mjs'],{cwd:path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),shell:true,encoding:'utf8'});
  const nodeSummary={status:testRun.status??1,...parseNodeTestSummary(testRun.stdout??'')};

  let searchHash=null;
  if(searchFile) searchHash=shaNormalizedFile(searchFile);
  else if(mode==='replay'&&searchOverride) searchHash=searchOverride;

  const result=evaluateFinalLock({
    liveGolden:read(livePath),priorGate:read(gatePath),actualSearchHash:searchHash,nodeTests:nodeSummary,mode
  });

  fs.mkdirSync(outDir,{recursive:true});
  const auditPath=path.join(outDir,'P1_PASS5_FINAL_GATE_AUDIT.json');
  fs.writeFileSync(auditPath,JSON.stringify({...result,nodeTestStdout:testRun.stdout,nodeTestStderr:testRun.stderr},null,2));

  // Never write a LOCKED manifest in replay mode.
  if(result.pass && mode==='live'){
    const lock={
      schema:'HNL-P1-PASS5-LOCKED',
      version:'1.25.7',
      generatedAt:new Date().toISOString(),
      status:'LOCKED',
      liveGolden:read(livePath),
      priorGate:read(gatePath),
      searchBrainSha256:searchHash,
      nodeTests:nodeSummary,
      invariant:'Importer/bridge is parse-normalize-map-validate-handoff only; no reaction/capacity/utilization/governing calculation.'
    };
    fs.writeFileSync(path.join(outDir,'P1_PASS5_LOCKED.json'),JSON.stringify(lock,null,2));
  } else {
    fs.writeFileSync(path.join(outDir,'P1_PASS5_BLOCKED.json'),JSON.stringify(result,null,2));
  }

  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.pass ? 0 : 2;
}
