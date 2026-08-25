import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFinalLock, LOCKED_SEARCH_BRAIN_SHA256 } from '../tools/p1-pass5-final-lock-gate.mjs';

const prior={pureNode:{
 regression:{status:'PASS',passed:388,failed:0},
 fullTableGolden:{status:'PASS',passed:1242,failed:0},
 pileQuantity:{status:'PASS',xlsmRows:'39/39',xlsmChecks:'273/273'},
 searchBrain:{status:'PASS',sha256:LOCKED_SEARCH_BRAIN_SHA256}
}};
const live={
 pass:true,issues:[],
 checked:{coordinates:194,nodalEnvelopes:19,pierForces:234},
 coverage:{coordinates:true,nodalEnvelopes:true,pierForces:true,pointSpringAssignments:true,pierSection:true},
 live:{
  units:{normalizedTo:'kN_m_C',verified:true},
  unitRestore:{restored:true},
  directVsTableCoordinates:{status:'PASS',matches:true,checked:194},
  directVsTableReactions:{status:'PASS',matches:true,checkedGroups:19}
 }
};
const nodeTests={status:0,tests:126,pass:126,fail:0};

test('final lock evaluator passes all exact live gates',()=>{
 const r=evaluateFinalLock({liveGolden:live,priorGate:prior,actualSearchHash:LOCKED_SEARCH_BRAIN_SHA256,nodeTests,mode:'live'});
 assert.equal(r.pass,true); assert.equal(r.lockStatus,'P1_PASS5_LOCKED');
});
test('replay mode can never satisfy final live lock',()=>{
 const r=evaluateFinalLock({liveGolden:live,priorGate:prior,actualSearchHash:LOCKED_SEARCH_BRAIN_SHA256,nodeTests,mode:'replay'});
 assert.equal(r.pass,false); assert.ok(r.failed.includes('LIVE_GOLDEN_MODE'));
});
test('wrong Search Brain hash blocks',()=>{
 const r=evaluateFinalLock({liveGolden:live,priorGate:prior,actualSearchHash:'bad',nodeTests,mode:'live'});
 assert.equal(r.pass,false); assert.ok(r.failed.includes('ACTUAL_SEARCH_FILE_HASH'));
});
test('unit restore failure blocks',()=>{
 const x=structuredClone(live); x.live.unitRestore={restored:false};
 const r=evaluateFinalLock({liveGolden:x,priorGate:prior,actualSearchHash:LOCKED_SEARCH_BRAIN_SHA256,nodeTests,mode:'live'});
 assert.equal(r.pass,false); assert.ok(r.failed.includes('LIVE_UNIT_RESTORE'));
});
test('partial coverage blocks',()=>{
 const x=structuredClone(live); x.checked.pierForces=233;
 const r=evaluateFinalLock({liveGolden:x,priorGate:prior,actualSearchHash:LOCKED_SEARCH_BRAIN_SHA256,nodeTests,mode:'live'});
 assert.equal(r.pass,false); assert.ok(r.failed.includes('LIVE_EXACT_COVERAGE'));
});
test('prior regression failure blocks',()=>{
 const g=structuredClone(prior); g.pureNode.regression.failed=1;
 const r=evaluateFinalLock({liveGolden:live,priorGate:g,actualSearchHash:LOCKED_SEARCH_BRAIN_SHA256,nodeTests,mode:'live'});
 assert.equal(r.pass,false); assert.ok(r.failed.includes('PRIOR_REGRESSION_388'));
});
