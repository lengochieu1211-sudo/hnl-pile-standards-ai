import test from 'node:test';
import assert from 'node:assert/strict';
import { calcDynamic10304 } from '../src/tcvn10304-advanced.js';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('P5.4 CT22 boundary sa=0.002 uses residual-set branch',()=>{
  const x=calcDynamic10304('sa=0.002 m A=0.16 m2 M=1 Ed=12 kJ m1=2 T m2=1 T m3=0 T eps2=0.2');
  assert.equal(x.ok,true); assert.equal(x.branch,'CT22');
  close(x.RuKn,919.5952354284653,1e-6);
});

test('P5.4 CT22 deterministic representative case',()=>{
  const x=calcDynamic10304('sa=0.004 m A=0.16 m2 M=1 Ed=12 kJ m1=2 T m2=1 T m3=0 T eps2=0.2');
  assert.equal(x.ok,true); assert.equal(x.branch,'CT22'); close(x.RuKn,616.4781055808788,1e-6);
  assert.ok(x.provenance.some(v=>v.includes('CT (22)')));
});

test('P5.4 CT22 requires explicit Table 12 M and never invents it',()=>{
  const x=calcDynamic10304('sa=0.004 m A=0.16 m2 Ed=12 kJ m1=2 T m2=1 T');
  assert.equal(x.ok,false); assert.ok(x.missing.some(v=>v.includes('Bảng 12')));
});

test('P5.4 CT23 accepts explicit theta and preserves CT23-24 provenance',()=>{
  const x=calcDynamic10304('sa=0.001 m sel=0.002 m Ed=12 kJ m2=1 T m4=3 T theta=0.0001 1/kN');
  assert.equal(x.ok,true); assert.equal(x.branch,'CT23'); close(x.RuKn,3553.139811170595,1e-6);
  assert.ok(x.provenance.some(v=>v.includes('CT (23),(24)')));
});

test('P5.4 CT24 derived-theta path refuses incomplete geometry',()=>{
  const x=calcDynamic10304('sa=0.001 m sel=0.002 m Ed=12 kJ m2=1 T m4=3 T');
  assert.equal(x.ok,false); assert.ok(x.missing.includes('A (m²)')); assert.ok(x.missing.includes('A_f (m²)'));
});

test('P5.4 PDA/HSDT isolation: PDA alone is not falsely routed through CT22-24',()=>{
  const x=solveEngineeringQuestion('PDA HSDT xác định sức chịu tải cọc từ báo cáo thử động biến dạng lớn');
  assert.notEqual(x?.workflow?.id,'10304-dynamic');
  const y=engineeringExcelPayload('Thử động sa=0.004 m A=0.16 m2 M=1 Ed=12 kJ m1=2 T m2=1 T');
  assert.equal(y.canExport,true);
});
