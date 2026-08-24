import test from 'node:test';
import assert from 'node:assert/strict';
import { solveEngineeringQuestion, engineeringExcelPayload, WORKFLOW_REGISTRY } from '../src/engineering-router.js';
import { lookup7888, lookupNph7888 } from '../src/tcvn7888.js';
import { annulusAreaMm2 } from '../src/calculators.js';
const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('v1.23 TCVN 7888 PHC D600-B is full free-text deterministic workflow',()=>{
  const r=solveEngineeringQuestion('Tính PHC D600-B dài 20 m sigmaCu=80 MPa');
  assert.equal(r.workflow?.id,'7888-material'); assert.equal(r.result?.ok,true);
  const A=annulusAreaMm2({diameterMm:600,thicknessMm:90});
  close(r.result.areaMm2,A); close(r.result.longTermKn,3007.581286966663); close(r.result.shortTermKn,6015.162573933326); close(r.result.pmaxKn,4812.130059146661);
  assert.equal(r.result.lookup.crackMoment,245.2); assert.equal(r.result.lookup.shearResistance,392.4);
  assert.match(r.result.provenance.join(' '),/Bảng 1/); assert.match(r.result.provenance.join(' '),/B\.4/);
});

test('v1.23 TCVN 7888 PC uses B.2/B.3 and does not present shear as PC requirement',()=>{
  const r=solveEngineeringQuestion('Tính PC D400-A dài 12 m sigmaCu=60 MPa');
  assert.equal(r.result?.ok,true); close(r.result.longTermKn,957.7145204468484); close(r.result.pmaxKn,1532.3432327149576);
  assert.match(r.result.steps.join(' '),/B\.2/); assert.doesNotMatch(r.result.steps[0],/V=/);
});

test('v1.23 TCVN 7888 NPH uses Table 2 and rejects AB',()=>{
  const ok=solveEngineeringQuestion('Tính NPH 800-600-B dài 20 m sigmaCu=80 MPa');
  assert.equal(ok.result?.ok,true); assert.equal(ok.result.lookup.designation,'800-600'); assert.match(ok.result.provenance.join(' '),/Bảng 2/);
  const bad=solveEngineeringQuestion('Tính NPH D600-AB dài 12 m sigmaCu=80 MPa');
  assert.equal(bad.result?.ok,false); assert.match(bad.result.missing.join(' '),/không có cấp AB/);
});

test('v1.23 TCVN 7888 concrete strength safety gates PC/PHC/NPH',()=>{
  assert.equal(solveEngineeringQuestion('PHC D600-B dài 20 m sigmaCu=79 MPa').result.ok,false);
  assert.equal(solveEngineeringQuestion('NPH 800-600-B dài 20 m sigmaCu=79 MPa').result.ok,false);
  assert.equal(solveEngineeringQuestion('PC D400-A dài 12 m sigmaCu=59 MPa').result.ok,false);
});

test('v1.23 TCVN 7888 length outside table is warning not silent rejection',()=>{
  const r=solveEngineeringQuestion('PHC D600-B dài 26 m sigmaCu=80 MPa');
  assert.equal(r.result.ok,true); assert.equal(r.result.lengthOk,false); assert.match(r.result.lengthWarning,/ngoài khoảng Bảng 1/);
});

test('v1.23 TCVN 7888 table anchors remain exact against PDF',()=>{
  const p=lookup7888(600,'B'); assert.deepEqual([p.thickness,p.crackMoment,p.effectiveStress,p.shearResistance,p.lengthRange],[90,245.2,8,392.4,'6–24']);
  const n=lookupNph7888(600,'B'); assert.deepEqual([n.designation,n.noduleDiameterMax,n.thickness,n.crackMoment,n.effectiveStress,n.shearResistance],['800-600',800,90,245.2,8,392.4]);
});

test('v1.23 engineering Excel payload carries solved 7888 inputs',()=>{
  const p=engineeringExcelPayload('Tính PHC D600-B dài 20 m sigmaCu=80 MPa');
  assert.equal(p.recognized,true); assert.equal(p.workflow.id,'7888-material'); assert.equal(p.result.ok,true); assert.equal(p.input.diameter,600); assert.equal(p.input.loadClass,'B'); assert.equal(p.input.sigmaCe,8);
});

test('v1.23 AI chat export path includes TCVN 7888 specialized production workbook',async()=>{
  const {readFile}=await import('node:fs/promises');
  const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  const excel=await readFile(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(main,/\^\(7888\|10304\|5574\)-/); assert.match(main,/export7888WorkflowWorkbook/); assert.match(main,/payload\.workflow\.id==='7888-material'/);
  assert.match(excel,/export async function export7888WorkflowWorkbook/); assert.match(excel,/A0=π\/4/); assert.match(excel,/Pmax/); assert.match(excel,/Bảng 2 · trang 12/);
});

test('v1.23 all three standard families remain registered in universal router',()=>{
  const standards=new Set(WORKFLOW_REGISTRY.map(x=>x.standard));
  assert.ok(standards.has('TCVN 7888:2014')); assert.ok(standards.has('TCVN 10304:2025')); assert.ok(standards.has('TCVN 5574:2018'));
  assert.ok(WORKFLOW_REGISTRY.filter(x=>x.standard==='TCVN 10304:2025').length>=13);
  assert.ok(WORKFLOW_REGISTRY.filter(x=>x.standard==='TCVN 5574:2018').length>=18);
});
