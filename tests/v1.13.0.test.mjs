import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEngineeringWorkflow, solveEngineeringQuestion, deterministicEngineeringContext } from '../src/engineering-router.js';

test('v1.13 router recognizes driven square pile and refuses missing geology',()=>{
  const r=solveEngineeringQuestion('tính sức chịu tải cọc vuông dài 12m cạnh 0,4m đóng vào đất dính');
  assert.equal(r.workflow.id,'10304-driven');
  assert.equal(r.result.ok,false);
  assert.ok(r.result.missing.length);
});

test('v1.13 router keeps deterministic geometry for driven pile',()=>{
  const c=deterministicEngineeringContext('tính sức chịu tải cọc vuông dài 12m cạnh 0,4m đóng vào đất dính');
  assert.match(c,/A=0\.1600 m²/);
  assert.match(c,/u=1\.6000 m/);
  assert.match(c,/THIẾU/);
});

test('v1.13 lookup B30 deterministic',()=>{
  const r=solveEngineeringQuestion('B30 Rb bao nhiêu theo TCVN 5574');
  assert.equal(r.workflow.id,'5574-material');
  assert.equal(r.result.concrete.Rb,17);
  assert.equal(r.result.concrete.Rbt,1.15);
  assert.equal(r.result.concrete.Eb,32500);
});

test('v1.13 lookup CB400-V deterministic',()=>{
  const r=solveEngineeringQuestion('CB400-V Rsw bao nhiêu');
  assert.equal(r.result.steel.Rsw,280);
  assert.equal(r.result.steel.Rs,350);
});

test('v1.13 rectangular bending equations 34 35',()=>{
  const r=solveEngineeringQuestion('dầm chịu uốn tiết diện chữ nhật B30 CB400-V b=300 mm h0=550 mm As=1500 mm2 M=200 kN.m');
  assert.equal(r.workflow.id,'5574-bending-rect');
  assert.equal(r.result.ok,true);
  assert.ok(r.result.x>0);
  assert.ok(r.result.Mu>0);
  assert.equal(typeof r.result.check,'boolean');
});

test('construction-effect workflow remains safely gated when required field data are missing',()=>{
  const r=solveEngineeringQuestion('ảnh hưởng thi công dao động');
  assert.equal(r.workflow.id,'10304-construction-effect');
  assert.equal(r.workflow.status,'VERIFIED');
  assert.equal(r.result.ok,false);
  assert.ok(r.result.missing.length>0);
});
