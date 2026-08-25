import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateLockedCapacityProfile,
  runPass6StructuralWorkflow
} from '../src/pass6-structural-workflow.js';

const fixture=JSON.parse(fs.readFileSync('artifacts/p1-pass5-dce-table-bundle-fixture-v13.json','utf8'));
const pq=JSON.parse(fs.readFileSync('artifacts/pile-quantity-golden-v1.25.7.json','utf8'));
const csvDir=path.resolve('artifacts/p1-pass5-csv-fallback-v14');
const readCsv=(n)=>fs.readFileSync(path.join(csvDir,`${n}.csv`),'utf8');

const lockedCapacity={
  status:'LOCKED_MULTI_BOREHOLE_INTEGRATED',
  RpileKn:pq.baseCase.capacity.RpileKn,
  gammaN:pq.baseCase.capacity.gammaN,
  NdMaxPerPileKn:pq.baseCase.capacity.NdMaxPerPileKn,
  sourceModule:'PileCapacityEngine / MultiBoreholePileEngine',
  sourceArtifact:'pile-quantity-golden-v1.25.7.json / LOCKED-RPILE-MIN',
  governingBasis:'Rpile=min(Rsoil,Rmaterial), then Nd,max=Rpile/gammaN'
};

function dceSource(){return {
  kind:'DCE_TABLES',tables:fixture.tables,sourceId:'DCE_EXACT_PASS6_GOLDEN',
  nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'
};}
function csvSource(){return {
  kind:'CSV',sourceId:'CSV_EXACT_PASS6_GOLDEN',unitsProfile:'kN_m_C',
  nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative',
  pointCoordinatesCsv:readCsv('pointCoordinates'),nodalReactionsCsv:readCsv('nodalReactions'),
  pointSpringAssignmentsCsv:readCsv('pointSpringAssignments'),pierForcesCsv:readCsv('pierForces'),pierSectionCsv:readCsv('pierSection')
};}

test('locked capacity exactly reproduces upstream Nd,max',()=>{
  const c=validateLockedCapacityProfile(lockedCapacity);
  assert.ok(Math.abs(c.NdMaxPerPileKn-733.4161490683232)<1e-12);
});
test('manual/unverified capacity is blocked',()=>{
  assert.throws(()=>validateLockedCapacityProfile({...lockedCapacity,status:'MANUAL'}),/must be LOCKED/);
});
test('inconsistent Rpile/gammaN versus supplied Nd,max is blocked',()=>{
  assert.throws(()=>validateLockedCapacityProfile({...lockedCapacity,NdMaxPerPileKn:700}),/inconsistency/);
});
test('DCE exact source runs one-button E2E through Pass 5 to Pass 4',()=>{
  const r=runPass6StructuralWorkflow({source:dceSource(),lockedCapacity});
  assert.equal(r.summary.pileCount,19);
  assert.equal(r.summary.combinationCount,1);
  assert.equal(r.summary.checkRows,19);
  assert.equal(r.summary.passRows,19);
  assert.equal(r.summary.failRows,0);
  assert.equal(r.summary.blockedRows,0);
  assert.equal(r.summary.overallPass,true);
});
test('DCE E2E governing pile is exact point 168 / EULS',()=>{
  const r=runPass6StructuralWorkflow({source:dceSource(),lockedCapacity});
  assert.equal(r.governing.pileId,'168');
  assert.equal(r.governing.pointId,'168');
  assert.equal(r.governing.combinationId,'EULS');
  assert.ok(Math.abs(r.governing.demandKn-365.2920507005818)<1e-9);
  assert.ok(Math.abs(r.governing.capacityKn-733.4161490683232)<1e-9);
  assert.ok(Math.abs(r.governing.utilization-0.4980692764464232)<1e-12);
});
test('CSV fallback gives identical E2E engineering result',()=>{
  const a=runPass6StructuralWorkflow({source:dceSource(),lockedCapacity});
  const b=runPass6StructuralWorkflow({source:csvSource(),lockedCapacity});
  assert.equal(b.summary.pileCount,a.summary.pileCount);
  assert.equal(b.summary.checkRows,a.summary.checkRows);
  assert.deepEqual(b.combinationIds,a.combinationIds);
  assert.equal(b.governing.pileId,a.governing.pileId);
  assert.ok(Math.abs(b.governing.demandKn-a.governing.demandKn)<1e-9);
  assert.ok(Math.abs(b.governing.utilization-a.governing.utilization)<1e-12);
});
test('all 19 DCE and CSV pile rows match point-by-point',()=>{
  const a=runPass6StructuralWorkflow({source:dceSource(),lockedCapacity});
  const b=runPass6StructuralWorkflow({source:csvSource(),lockedCapacity});
  const bm=new Map(b.rows.map(x=>[`${x.combinationId}/${x.pointId}`,x]));
  for(const x of a.rows){
    const y=bm.get(`${x.combinationId}/${x.pointId}`); assert.ok(y);
    assert.ok(Math.abs(x.demandKn-y.demandKn)<1e-9);
    assert.ok(Math.abs(x.capacityKn-y.capacityKn)<1e-9);
    assert.ok(Math.abs(x.utilization-y.utilization)<1e-12);
    assert.equal(x.pass,y.pass);
  }
});
test('Pass 6 preserves locked upstream capacity provenance',()=>{
  const r=runPass6StructuralWorkflow({source:dceSource(),lockedCapacity});
  assert.equal(r.capacity.sourceModule,lockedCapacity.sourceModule);
  assert.match(r.provenance.capacityArtifact,/LOCKED-RPILE-MIN/);
  assert.equal(r.provenance.reactionEngine,'P1_PASS4_IMPORTED_NUMERIC_CORE_LOCKED');
});
test('Pass 6 does not use DCE workbook Rd=350 as production capacity',()=>{
  const r=runPass6StructuralWorkflow({source:dceSource(),lockedCapacity});
  assert.ok(r.rows.every(x=>Math.abs(x.capacityKn-733.4161490683232)<1e-9));
  assert.ok(r.rows.every(x=>Math.abs(x.capacityKn-350)>1));
});
test('forced unknown combination blocks instead of silently selecting another',()=>{
  assert.throws(()=>runPass6StructuralWorkflow({source:dceSource(),lockedCapacity,combinationIds:['NOT_REAL']}),/No nodal reactions found/);
});
