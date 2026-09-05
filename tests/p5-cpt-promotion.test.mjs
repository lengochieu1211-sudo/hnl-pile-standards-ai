import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
import { productionStatusFor } from '../src/production-status-registry.js';
import { lookupTable16Cpt10304 } from '../src/tcvn10304-table-engine.js';

const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);

test('P5.2 keeps legacy CPT CT25-28 numeric result unchanged',()=>{
  const x=solveEngineeringQuestion('CPT A=0.16 m2 u=1.6 m h=12 m qs=5000 kPa fs=50 kPa beta1=0.65 beta2=1.2');
  assert.equal(x.result.ok,true);
  assert.equal(x.result.cptMode,'DRIVEN_CT25_28');
  close(x.result.RkKn,1672);
});

test('P5.2 Table 16 exact CPT bored lookup',()=>{
  close(lookupTable16Cpt10304({qc:5000,soil:'sand',component:'qb'}).value,900);
  close(lookupTable16Cpt10304({qc:5000,soil:'sand',component:'fi'}).value,30);
  close(lookupTable16Cpt10304({qc:2500,soil:'clay',component:'qb'}).value,580);
  close(lookupTable16Cpt10304({qc:2500,soil:'clay',component:'fi'}).value,25);
});

test('P5.2 Table 16 linear interpolation at intermediate qc',()=>{
  close(lookupTable16Cpt10304({qc:6250,soil:'sand',component:'qb'}).value,1000);
  close(lookupTable16Cpt10304({qc:6250,soil:'sand',component:'fi'}).value,35);
});

test('P5.2 CPT CT29 bored dry concrete computes deterministic tip + shaft',()=>{
  const x=solveEngineeringQuestion('Cọc khoan CPT D=600 mm L=6 m qc=5000 kPa đất cát đổ bê tông khô');
  assert.equal(x.workflow.id,'10304-cpt');
  assert.equal(x.result.ok,true);
  assert.equal(x.result.cptMode,'BORED_CT29');
  const A=Math.PI*0.6*0.6/4, u=Math.PI*0.6;
  const expected=900*A+u*1.0*30*6;
  close(x.result.RkKn,expected,1e-6);
  assert.equal(x.result.inputs.segmentCount,3);
  assert.ok(x.result.inputs.segmentThicknessM<=2);
  assert.ok(x.result.provenance.some(v=>v.includes('CT (29)')));
  assert.ok(x.result.provenance.some(v=>v.includes('Bảng 16')));
});

test('P5.2 CPT CT29 applies gammaRf=0.7 for bentonite/water/casing',()=>{
  const x=solveEngineeringQuestion('Cọc khoan CPT D=600 mm L=6 m qc=5000 kPa đất cát đổ bê tông dưới nước bentonite');
  assert.equal(x.result.ok,true);
  close(x.result.inputs.gammaRf,0.7);
  const A=Math.PI*0.6*0.6/4, u=Math.PI*0.6;
  close(x.result.RkKn,900*A+u*0.7*30*6,1e-6);
});

test('P5.2 CPT CT29 blocks Table 16 outside diameter applicability',()=>{
  const x=solveEngineeringQuestion('Cọc khoan CPT D=500 mm L=6 m qc=5000 kPa đất cát đổ bê tông khô');
  assert.equal(x.result.ok,false);
  assert.equal(x.result.status,'REVIEW');
  assert.ok(x.result.missing.some(v=>v.includes('0,6–1,2')));
});

test('P5.2 CPT CT29 blocks Table 16 when embedded length is below 5 m',()=>{
  const x=solveEngineeringQuestion('Cọc khoan CPT D=600 mm L=4 m qc=5000 kPa đất cát đổ bê tông khô');
  assert.equal(x.result.ok,false);
  assert.ok(x.result.missing.some(v=>v.includes('tối thiểu 5 m')));
});

test('P5.2 CPT production registry and export gate only open for successful deterministic result',()=>{
  const reg=productionStatusFor('10304-cpt');
  assert.equal(reg.productionNumeric,true);
  assert.ok(['LOCKED','VERIFIED'].includes(reg.status));
  const good=engineeringExcelPayload('Cọc khoan CPT D=600 mm L=6 m qc=5000 kPa đất cát đổ bê tông khô');
  assert.equal(good.canExport,true);
  const bad=engineeringExcelPayload('Cọc khoan CPT D=500 mm L=6 m qc=5000 kPa đất cát đổ bê tông khô');
  assert.equal(bad.canExport,false);
});
