import test from 'node:test';
import assert from 'node:assert/strict';
import { PASS5_CORE_LOCK } from '../src/pass5-core-status.js';
import { evaluateCoreLock } from '../tools/p1-pass5-core-lock-gate.mjs';

const pass4={lockDecision:{tmSctCocImportedCompressionNumericCore:'LOCKED'}};
const pass51={status:{canonicalSchema:'LOCKED',dceWorkbookTableAdapter:'LOCKED',csiFlatTableAdapter:'LOCKED_CONTRACT'},exactDceFixtureCounts:{pointCoordinates:194,nodalReactionRawRows:38,pointSpringAssignments:19,pierForces:234,pierSection:39,nodalReactionEnvelopes:19},golden:{pass4TmFzEnvelopeRows:'19/19 PASS',pass3PierforcesSourceRows:'39/39 PASS',pass4NumericHandoff:'reproduces exact TM SCT Coc OK/NOT OK when independent capacity is supplied'}};
const pass52={status:{pass52CsvFallback:'LOCKED',liveGoldenReplay:'PASS',fullPass5:'REVIEW_PENDING_WINDOWS_LIVE_GOLDEN'},goldenReplay:{issues:0},environment:{linuxLiveCsiApi:'NOT_RUN'}};
const prior={pureNode:{regression:{status:'PASS',passed:388,failed:0},fullTableGolden:{status:'PASS',passed:1242,failed:0},pileQuantity:{status:'PASS',xlsmRows:'39/39',xlsmChecks:'273/273'},searchBrain:{status:'PASS',sha256:'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2'}}};
const node={status:0,tests:132,pass:132,fail:0};

test('Pass5 Core status is LOCKED while live is deferred',()=>{
  assert.equal(PASS5_CORE_LOCK.status,'LOCKED');
  assert.ok(PASS5_CORE_LOCK.deferredScope.includes('LIVE_ETABS_SAP_CSI_API_CERTIFICATION'));
  assert.equal(PASS5_CORE_LOCK.productionNumeric,false);
});
test('core gate locks without live ETABS/SAP when all core evidence passes',()=>{
  const r=evaluateCoreLock({pass4,pass51,pass52,prior,node});
  assert.equal(r.pass,true); assert.equal(r.status,'LOCKED');
});
test('core gate blocks if canonical schema regresses',()=>{
  const x=structuredClone(pass51); x.status.canonicalSchema='REVIEW';
  const r=evaluateCoreLock({pass4,pass51:x,pass52,prior,node}); assert.equal(r.pass,false);
});
test('core gate blocks if CSV fallback regresses',()=>{
  const x=structuredClone(pass52); x.status.pass52CsvFallback='REVIEW';
  const r=evaluateCoreLock({pass4,pass51,pass52:x,prior,node}); assert.equal(r.pass,false);
});
test('core gate blocks if prior Search Brain evidence changes',()=>{
  const x=structuredClone(prior); x.pureNode.searchBrain.sha256='bad';
  const r=evaluateCoreLock({pass4,pass51,pass52,prior:x,node}); assert.equal(r.pass,false);
});
test('core gate blocks current test regression',()=>{
  const r=evaluateCoreLock({pass4,pass51,pass52,prior,node:{status:0,tests:133,pass:132,fail:1}}); assert.equal(r.pass,false);
});
