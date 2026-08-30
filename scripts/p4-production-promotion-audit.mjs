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
const ui=read('src/pdf-excel-intelligence/ui.js');
const countGate=read('tools/pass83-test-count-gate.mjs');
const selfPath='artifacts/p4-production-promotion/P4_PROMOTION_SELFTEST.json';
const runtimePath='artifacts/p4-runtime-golden/HNL_P4_RUNTIME_GOLDEN_CI.json';

check('APP_VERSION_1_27',pkg.version==='1.27.0'&&meta.appVersion==='1.27.0',`${pkg.version}/${meta.appVersion}`);
check('SEARCH_BRAIN_LOCK_META',meta.searchBrain==='1.9.23'&&meta.searchBrainStatus==='LOCKED',`${meta.searchBrain} ${meta.searchBrainStatus}`);
check('P4_CORE_STILL_SHADOW_ONLY',/P4_PROMOTION_STATE\s*=\s*['"]SHADOW_ONLY['"]/.test(p4),'core source remains SHADOW_ONLY');
check('PACKET_PRODUCTION_BARRIER',/productionMutationAllowed\s*:\s*false/.test(p4),'packet production mutation must stay false');
check('PACKET_CALC_BARRIER',/calculationEngineMutationAllowed\s*:\s*false/.test(p4),'packet calculation mutation must stay false');
check('EXACT_592_LOCK',/EXPECTED_TESTS\s*=\s*BASELINE_TESTS\s*\+\s*P4_ADDITIVE_TESTS/.test(countGate)&&/BASELINE_TESTS\s*=\s*574/.test(countGate)&&/P4_ADDITIVE_TESTS\s*=\s*18/.test(countGate),'574 + 18 = 592');
check('CONFIRMATION_CONTRACT_PRESENT',confirmation.includes('HNL_P4_REVIEW_CONFIRMATION_V1')&&confirmation.includes('CONFIRMATION_SOURCE_MISMATCH')&&confirmation.includes('CONFIRMATION_VALUE_MISMATCH'),'provenance-bound user confirmation');
check('ACTIVATION_MODE_WIRED',wrapper.includes("P4_REVIEW_PRODUCTION_MODE='REVIEW_PRODUCTION_EXPORT'")&&wrapper.includes("P4_REVIEW_PRODUCTION_STATE='VERIFIED_FOR_EXPORT'")&&wrapper.includes("P4_REVIEW_PRODUCTION_SCOPE='WORKBOOK_EXPORT_ONLY'"),'export-only activation constants');
check('ACTIVATION_NATIVE_PDF_ONLY',wrapper.includes('REVIEW_PRODUCTION_NATIVE_PDF_ONLY')&&wrapper.includes('REVIEW_PRODUCTION_NATIVE_ENGINE_REQUIRED')&&wrapper.includes('REVIEW_PRODUCTION_NATIVE_ROUTE_REQUIRED')&&wrapper.includes("source.engine)!=='pdfjs-native-region'")&&wrapper.includes("source.route)!=='native'"),'OCR/Vision/scan cannot use activation path');
check('ACTIVATION_VALUE_BOUND',wrapper.includes('SOURCE_VALUE_MISSING')&&wrapper.includes('validateP4ReviewConfirmation'),'non-empty value + confirmation binding required');
check('EXPORTER_MUTATION_BARRIERS',wrapper.includes('calculationEngineMutationAllowed:false')&&wrapper.includes('productionMutationAllowed:false'),'workbook export does not unlock production/calculation mutation');
check('EXPORTER_NO_SEARCH_IMPORT',!/(?:from|import\()\s*['"][^'"]*search\.js/.test(wrapper),'wrapper must not import Search Brain');
check('EXPORTER_NO_CALC_IMPORT',!/(?:from|import\()\s*['"][^'"]*(?:calculators|pile-capacity|pile-reaction|pile-workflows|engineering-router)[^'"]*['"]/.test(wrapper),'wrapper must not import Calculation Engine modules');
check('UI_REVIEW_PATH_PRESERVED',ui.includes('Xuất Excel REVIEW')&&ui.includes('onExportSelection')&&ui.includes('exportP4ExcelWorkbook([packet]'),'existing REVIEW path remains available');
check('UI_PRODUCTION_OPT_IN_PRESENT',ui.includes('Xuất Production đã đối chiếu')&&ui.includes('p4ExportCurrentPageProduction')&&ui.includes('window.confirm(nativeReviewPrompt(source))'),'explicit separate user opt-in');
check('UI_CONFIRMATION_CONTRACT_USED',ui.includes('createP4ReviewConfirmation')&&ui.includes('createP4ReviewedNativeExportPacket')&&ui.includes('exportP4ReviewedProductionWorkbook'),'UI uses bound confirmation and scoped exporter');
check('UI_MACHINE_SOURCES_BLOCKED',ui.includes("source?.method||'')!=='text-layer'")&&ui.includes('OCR/Vision/scan vẫn chỉ được xuất REVIEW'),'UI blocks machine-read sources from production-reviewed path');

let self=null;
if(exists(selfPath)){
  self=json(selfPath);
  check('FAILURE_MODE_SELFTEST_18',self.fail===0&&self.pass===self.total&&self.total>=18,`${self.pass}/${self.total}, fail=${self.fail}`);
  check('SELFTEST_EXACT_SHA',!expectedSha||String(self.sourceSha).toLowerCase()===expectedSha,`selftest=${self.sourceSha} expected=${expectedSha||'n/a'}`);
  check('SELFTEST_ACTIVATION_SCOPE',self.activation?.mode==='REVIEW_PRODUCTION_EXPORT'&&self.activation?.state==='VERIFIED_FOR_EXPORT'&&self.activation?.scope==='WORKBOOK_EXPORT_ONLY'&&self.activation?.nativePdfOnly===true,'activation report scope');
}else check('FAILURE_MODE_SELFTEST_18',false,'missing selftest report');

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
  schema:'HNL_P4_REVIEW_PRODUCTION_ACTIVATION_AUDIT_V1',
  generatedAt:new Date().toISOString(),
  expectedSha:expectedSha||null,
  appVersion:pkg.version,
  sourcePromotionState:'SHADOW_ONLY',
  activatedMode:'REVIEW_PRODUCTION_EXPORT',
  activatedState:'VERIFIED_FOR_EXPORT',
  activatedScope:'WORKBOOK_EXPORT_ONLY',
  readiness:ready?'ACTIVATION_CERTIFIED_EXPORTER_ONLY':'HOLD',
  ready,
  nativePdfOnly:true,
  productionMutationAllowed:false,
  calculationEngineMutationAllowed:false,
  checks,
  blockers:failed.map(x=>({id:x.id,detail:x.detail})),
  nextGate:ready?'PR exact-head workflows may certify and merge exporter-only activation. Calculation Engine remains locked.':'Close every blocker and rerun on exact head. Queued/in_progress is not PASS.'
};
const out=path.join(root,'artifacts','p4-production-promotion');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'P4_PROMOTION_AUDIT.json'),JSON.stringify(report,null,2));
console.log(`P4 REVIEW PRODUCTION ACTIVATION AUDIT: ${report.readiness}`);
for(const c of checks)console.log(`${c.state} ${c.id}${c.detail?` · ${c.detail}`:''}`);
if(args.has('--enforce-ready')&&!ready)process.exitCode=1;
