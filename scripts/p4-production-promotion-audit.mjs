import fs from 'node:fs';
import path from 'node:path';

const args=new Set(process.argv.slice(2));
const root=process.cwd();
const expectedSha=String(process.env.HNL_SOURCE_SHA||'').trim().toLowerCase();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const exists=p=>fs.existsSync(path.join(root,p));
const checks=[];
function check(id,ok,detail=''){checks.push({id,state:ok?'PASS':'FAIL',detail});return ok;}

const pkg=json('package.json');
const meta=json('public/release-meta.json');
const p4=read('src/p4-pdf-excel-intelligence.js');
const wrapper=read('src/pdf-excel-intelligence/review-production-export.js');
const confirmation=read('src/pdf-excel-intelligence/confirmation-contract.js');
const countGate=read('tools/pass83-test-count-gate.mjs');
const selfPath='artifacts/p4-production-promotion/P4_PROMOTION_SELFTEST.json';
const runtimePath='artifacts/p4-runtime-golden/HNL_P4_RUNTIME_GOLDEN_CI.json';

check('APP_VERSION_1_27',pkg.version==='1.27.0'&&meta.appVersion==='1.27.0',`${pkg.version}/${meta.appVersion}`);
check('SEARCH_BRAIN_LOCK_META',meta.searchBrain==='1.9.23'&&meta.searchBrainStatus==='LOCKED',`${meta.searchBrain} ${meta.searchBrainStatus}`);
check('P4_STILL_SHADOW_ONLY',/P4_PROMOTION_STATE\s*=\s*['"]SHADOW_ONLY['"]/.test(p4),'source must remain SHADOW_ONLY during evidence closure');
check('PACKET_PRODUCTION_BARRIER',/productionMutationAllowed\s*:\s*false/.test(p4),'packet production mutation must stay false');
check('PACKET_CALC_BARRIER',/calculationEngineMutationAllowed\s*:\s*false/.test(p4),'packet calculation mutation must stay false');
check('EXACT_592_LOCK',/EXPECTED_TESTS\s*=\s*BASELINE_TESTS\s*\+\s*P4_ADDITIVE_TESTS/.test(countGate)&&/BASELINE_TESTS\s*=\s*574/.test(countGate)&&/P4_ADDITIVE_TESTS\s*=\s*18/.test(countGate),'574 + 18 = 592');
check('CONFIRMATION_CONTRACT_PRESENT',confirmation.includes('HNL_P4_REVIEW_CONFIRMATION_V1')&&confirmation.includes('CONFIRMATION_SOURCE_MISMATCH')&&confirmation.includes('CONFIRMATION_VALUE_MISMATCH'),'provenance-bound user confirmation');
check('EXPORTER_ONLY_CANDIDATE',wrapper.includes('REVIEW_PRODUCTION_EXPORT_CANDIDATE')&&wrapper.includes('calculationEngineMutationAllowed:false')&&wrapper.includes('productionMutationAllowed:false'),'candidate allows workbook export only after gate');
check('EXPORTER_NO_SEARCH_IMPORT',!/(?:from|import\()\s*['"][^'"]*search\.js/.test(wrapper),'wrapper must not import Search Brain');
check('EXPORTER_NO_CALC_IMPORT',!/(?:from|import\()\s*['"][^'"]*(?:calc|calculation|engine)[^'"]*['"]/.test(wrapper),'wrapper must not import Calculation Engine');

let self=null;
if(exists(selfPath)){
  self=json(selfPath);
  check('FAILURE_MODE_SELFTEST',self.fail===0&&self.pass===self.total&&self.total>=12,`${self.pass}/${self.total}, fail=${self.fail}`);
  check('SELFTEST_EXACT_SHA',!expectedSha||String(self.sourceSha).toLowerCase()===expectedSha,`selftest=${self.sourceSha} expected=${expectedSha||'n/a'}`);
}else check('FAILURE_MODE_SELFTEST',false,'missing selftest report');

let runtime=null;
if(exists(runtimePath)){
  runtime=json(runtimePath);
  const runtimePass=Object.values(runtime.cases||{}).filter(x=>x?.state==='RUNTIME_PASS').length;
  const runtimeSha=String(runtime?.automation?.expectedSha||runtime?.environment?.commit||'').toLowerCase();
  check('CURRENT_RUNTIME_GOLDEN_5_OF_5',runtimePass===5&&runtime.overallState==='COMPLETE',`${runtimePass}/5 overall=${runtime.overallState}`);
  check('RUNTIME_EXACT_SHA',Boolean(expectedSha)&&runtimeSha===expectedSha,`runtime=${runtimeSha} expected=${expectedSha||'MISSING'}`);
  check('RUNTIME_MUTATION_BARRIERS',runtime.productionMutationAllowed===false&&runtime.calculationEngineMutationAllowed===false,'runtime barriers must remain false');
}else{
  check('CURRENT_RUNTIME_GOLDEN_5_OF_5',false,'missing current runtime evidence');
  check('RUNTIME_EXACT_SHA',false,'missing current runtime evidence');
  check('RUNTIME_MUTATION_BARRIERS',false,'missing current runtime evidence');
}

const failed=checks.filter(x=>x.state==='FAIL');
const ready=failed.length===0;
const report={
  schema:'HNL_P4_PRODUCTION_PROMOTION_AUDIT_V1',
  generatedAt:new Date().toISOString(),
  expectedSha:expectedSha||null,
  appVersion:pkg.version,
  sourcePromotionState:'SHADOW_ONLY',
  proposedMode:'REVIEW_PRODUCTION_EXPORT',
  readiness:ready?'READY_TO_PROMOTE_EXPORTER_ONLY':'HOLD',
  ready,
  productionMutationAllowed:false,
  calculationEngineMutationAllowed:false,
  checks,
  blockers:failed.map(x=>({id:x.id,detail:x.detail})),
  nextGate:ready?'Separate promotion commit may wire REVIEW_PRODUCTION_EXPORT only; Calculation Engine remains locked.':'Close every blocker and rerun on exact head. Queued/in_progress is not PASS.'
};
const out=path.join(root,'artifacts','p4-production-promotion');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'P4_PROMOTION_AUDIT.json'),JSON.stringify(report,null,2));
console.log(`P4 PRODUCTION PROMOTION AUDIT: ${report.readiness}`);
for(const c of checks)console.log(`${c.state} ${c.id}${c.detail?` · ${c.detail}`:''}`);
if(args.has('--enforce-ready')&&!ready)process.exitCode=1;
