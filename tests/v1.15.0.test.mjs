import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEngineeringQuestion, WORKFLOW_REGISTRY } from '../src/engineering-router.js';
import { calcDynamic10304, calcSingleSettlement10304, calcGroupSettlement10304, calcEquivalentBlock10304, verifyPiledRaft10304 } from '../src/tcvn10304-advanced.js';
import { CODEPACK_10304 } from '../src/codepacks.js';

test('v1.15 dynamic CT22 computes deterministic result',()=>{
  const r=calcDynamic10304('sa=0.003 m A=0.16 m2 eta=1500 M=1 Ed=45 kJ m1=3 T m2=2 T m3=0 T eps2=0.2');
  assert.equal(r.ok,true); assert.equal(r.branch,'CT22'); assert.ok(r.RuKn>0);
});
test('v1.15 dynamic CT23+24 computes with explicit theta',()=>{
  const r=calcDynamic10304('sa=0.001 m sel=0.001 m Ed=45 kJ m2=2 T m4=3 T theta=0.0002 1/kN');
  assert.equal(r.ok,true); assert.equal(r.branch,'CT23'); assert.ok(r.RuKn>0);
});
test('v1.15 single pile settlement long branch CT30-33',()=>{
  const r=calcSingleSettlement10304('lún cọc đơn N=1 MN G1=20 MPa G2=15 MPa L=20 m d=0.6 m v1=0.3 v2=0.3 EA=10000 MN');
  assert.equal(r.ok,true); assert.equal(r.branch,'long'); assert.ok(r.settlementM>0);
});
test('v1.15 single pile settlement short branch CT34',()=>{
  const r=calcSingleSettlement10304('lún cọc đơn N=1 MN G1=10 MPa G2=30 MPa L=12 m d=0.6 m v1=0.3 v2=0.3');
  assert.equal(r.ok,true); assert.equal(r.branch,'short'); assert.ok(r.settlementM>0);
});
test('v1.15 group settlement CT36-38 parses interactions',()=>{
  const r=calcGroupSettlement10304('lún nhóm cọc s_single=0.01 m G1=20 MPa G2=20 MPa L=20 m v1=0.3 v2=0.3 a1=1.8 m N1=1 MN; a2=3.6 m N2=1 MN');
  assert.equal(r.ok,true); assert.equal(r.pairs.length,2); assert.ok(r.settlementM>=0.01);
});
test('v1.15 equivalent block CT41-45 includes MPa/kPa conversion',()=>{
  const r=calcEquivalentBlock10304('móng khối quy ước sef=0.015 m E1=20 MPa E2=30 MPa v2=0.3 p=200 kPa a=1.8 m d=0.6 m L=20 m E=30000 MPa A=0.283 m2 b=0.6 m');
  assert.equal(r.ok,true); assert.ok(r.settlementM>0 && r.settlementM<1);
});
test('v1.15 piled raft is verified method but does not invent closed-form result',()=>{
  const w=WORKFLOW_REGISTRY.find(x=>x.id==='10304-piled-raft'); assert.equal(w.status,'VERIFIED_METHOD');
  const r=verifyPiledRaft10304('móng bè-cọc IL=0.4 E=10 MPa loose_sand=0.5 m'); assert.equal(r.ok,true); assert.equal(r.methodOnly,true); assert.equal(r.eligible,true);
});
test('v1.15 router advanced workflow statuses are upgraded',()=>{
  for(const id of ['10304-dynamic','10304-settlement-single','10304-settlement-group','10304-equivalent-block']) assert.equal(WORKFLOW_REGISTRY.find(x=>x.id===id)?.status,'VERIFIED');
});
test('v1.15 code pack CT22-46 no longer REVIEW where numeric formula exists',()=>{
  const labels=['(22)','(23)','(24)','(30)','(32)','(33)','(34)','(35)','(36)','(39)','(40)','(41)','(42)','(43)','(44)','(45)','(46)'];
  for(const l of labels){ const f=CODEPACK_10304.formulas.find(x=>x.label===l); assert.equal(f.status,'Verified',l); assert.equal(f.computable,true,l); assert.ok(f.rhs,l); }
});
test('v1.15 router returns numeric single settlement from natural query',()=>{
 const x=solveEngineeringQuestion('tính lún cọc đơn N=1 MN G1=20 MPa G2=15 MPa L=20 m d=0.6 m v1=0.3 v2=0.3 EA=10000 MN');
 assert.equal(x.workflow.id,'10304-settlement-single'); assert.equal(x.result.ok,true);
});
