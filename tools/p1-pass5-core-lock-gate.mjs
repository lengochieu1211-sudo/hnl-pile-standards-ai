import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SEARCH_SHA='f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2';
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function ok(name, pass, detail){return {name,status:pass?'PASS':'FAIL',detail};}
function parseNode(stdout){
  const get=(k)=>{const m=stdout.match(new RegExp(`# ${k} (\\d+)`));return m?Number(m[1]):null;};
  return {tests:get('tests'),pass:get('pass'),fail:get('fail')};
}
export function evaluateCoreLock({pass4,pass51,pass52,prior,node}){
  const c=[];
  c.push(ok('PASS4_IMPORTED_NUMERIC_CORE',pass4?.lockDecision?.tmSctCocImportedCompressionNumericCore==='LOCKED',pass4?.lockDecision));
  c.push(ok('PASS51_CANONICAL_SCHEMA',pass51?.status?.canonicalSchema==='LOCKED',pass51?.status));
  c.push(ok('PASS51_DCE_TABLE_ADAPTER',pass51?.status?.dceWorkbookTableAdapter==='LOCKED',pass51?.status));
  c.push(ok('PASS51_CSI_FLAT_CONTRACT',pass51?.status?.csiFlatTableAdapter==='LOCKED_CONTRACT',pass51?.status));
  c.push(ok('PASS51_EXACT_COUNTS',
    pass51?.exactDceFixtureCounts?.pointCoordinates===194 &&
    pass51?.exactDceFixtureCounts?.nodalReactionRawRows===38 &&
    pass51?.exactDceFixtureCounts?.pointSpringAssignments===19 &&
    pass51?.exactDceFixtureCounts?.pierForces===234 &&
    pass51?.exactDceFixtureCounts?.pierSection===39 &&
    pass51?.exactDceFixtureCounts?.nodalReactionEnvelopes===19,
    pass51?.exactDceFixtureCounts));
  c.push(ok('PASS51_GOLDEN_HANDOFF',
    String(pass51?.golden?.pass4TmFzEnvelopeRows??'').startsWith('19/19 PASS') &&
    String(pass51?.golden?.pass3PierforcesSourceRows??'').startsWith('39/39 PASS') &&
    /reproduces exact TM SCT Coc/.test(pass51?.golden?.pass4NumericHandoff??''),pass51?.golden));
  c.push(ok('CSV_FALLBACK_LOCKED',pass52?.status?.pass52CsvFallback==='LOCKED',pass52?.status));
  c.push(ok('LIVE_REPLAY_CONTRACT',pass52?.status?.liveGoldenReplay==='PASS',pass52?.goldenReplay));
  c.push(ok('LIVE_CERTIFICATION_DEFERRED',
    pass52?.environment?.linuxLiveCsiApi==='NOT_RUN' && pass52?.status?.fullPass5==='REVIEW_PENDING_WINDOWS_LIVE_GOLDEN',
    {status:pass52?.status?.fullPass5,environment:pass52?.environment}));
  c.push(ok('CURRENT_NODE_REGRESSION',node?.status===0 && node?.fail===0 && node?.tests>=132 && node?.pass===node?.tests,node));
  const p=prior?.pureNode??{};
  c.push(ok('PRIOR_REGRESSION_388',p.regression?.status==='PASS'&&p.regression?.passed===388&&p.regression?.failed===0,p.regression));
  c.push(ok('PRIOR_FULL_TABLE_1242',p.fullTableGolden?.status==='PASS'&&p.fullTableGolden?.passed===1242&&p.fullTableGolden?.failed===0,p.fullTableGolden));
  c.push(ok('PRIOR_PILE_QUANTITY',p.pileQuantity?.status==='PASS'&&p.pileQuantity?.xlsmRows==='39/39'&&p.pileQuantity?.xlsmChecks==='273/273',p.pileQuantity));
  c.push(ok('PRIOR_SEARCH_BRAIN',p.searchBrain?.status==='PASS'&&p.searchBrain?.sha256===SEARCH_SHA,p.searchBrain));
  const failed=c.filter(x=>x.status!=='PASS');
  return {schema:'HNL-P1-PASS5-CORE-LOCK-GATE',version:'1.25.7',status:failed.length?'BLOCKED':'LOCKED',pass:failed.length===0,checks:c,failed:failed.map(x=>x.name),liveCertification:'DEFERRED_NOT_REQUIRED_FOR_CORE_LOCK'};
}

if(process.argv[1]?.endsWith('p1-pass5-core-lock-gate.mjs')){
  const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
  const run=spawnSync(process.execPath,['--test','tests/*.test.mjs'],{cwd:root,shell:true,encoding:'utf8'});
  const node={status:run.status??1,...parseNode(run.stdout??'')};
  const result=evaluateCoreLock({
    pass4:read(path.join(root,'artifacts/tm-sct-coc-exact-gate-v12.json')),
    pass51:read(path.join(root,'artifacts/p1-pass5-etabs-sap-importer-gate-v13.json')),
    pass52:read(path.join(root,'artifacts/p1-pass5-2-live-csi-bridge-gate-v14.json')),
    prior:read(path.join(root,'artifacts/gate-status-v1.25.7.json')),
    node
  });
  const out=path.join(root,'artifacts/P1_PASS5_CORE_LOCKED.json');
  const audit=path.join(root,'artifacts/P1_PASS5_CORE_LOCK_AUDIT.json');
  fs.writeFileSync(audit,JSON.stringify({...result,nodeStdout:run.stdout,nodeStderr:run.stderr},null,2));
  if(result.pass){
    fs.writeFileSync(out,JSON.stringify({
      schema:'HNL-P1-PASS5-CORE-LOCKED',version:'1.25.7',status:'LOCKED',generatedAt:new Date().toISOString(),
      scope:{locked:['canonical schema','DCE workbook table adapter','CSI flat-table contract','CSV fallback','Pass3/Pass4 handoff'],deferred:['Live CSi API certification','Windows Excel COM certification','full-source integration']},
      exactCoverage:{pointCoordinates:194,nodalReactionRawRows:38,nodalReactionEnvelopes:19,pointSpringAssignments:19,pierForces:234,pierSection:39},
      tests:node,priorRegression:{regression:'388/388',fullTable:'1242/1242',pileQuantity:'39/39 + 273/273',searchBrainSha256:SEARCH_SHA},
      invariant:'Importer remains parse-normalize-map-validate-handoff only; no engineering reaction/capacity/utilization logic.',
      liveAdapter:{status:'READY_NOT_CERTIFIED_LIVE',futureGate:'windows/csi-bridge/RUN_PASS5_FINAL_LOCK.cmd'}
    },null,2));
  }
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.pass?0:2;
}
