import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { epsB2ShortHeavy5574, xiR5574, calcBendingRect5574, calcBendingT5574, calcEccentricRect5574, calcShear5574, calcTorsion5574, calcLocalCompression5574, calcPunching5574 } from '../src/tcvn5574-core.js';
import { solveEngineeringQuestion, WORKFLOW_REGISTRY, engineeringExcelPayload } from '../src/engineering-router.js';

test('TCVN5574 eps_b2 short-term heavy concrete follows 6.1.4.2',()=>{
  assert.equal(epsB2ShortHeavy5574('B30'),0.0035);
  assert.equal(epsB2ShortHeavy5574('B60'),0.0035);
  assert.equal(epsB2ShortHeavy5574('B70'),0.0033);
  assert.ok(Math.abs(epsB2ShortHeavy5574('B100')-0.0028)<1e-12);
});

test('TCVN5574 xiR CT31-32 B30 CB400-V',()=>{
  const r=xiR5574({Rs:350,Es:200000,epsB2:0.0035,highStrength:false});
  assert.ok(Math.abs(r.epsSel-0.00175)<1e-12);
  assert.ok(Math.abs(r.xiR-0.5333333333333333)<1e-12);
});

test('TCVN5574 rectangular flexure CT33-35 deterministic benchmark',()=>{
  const r=calcBendingRect5574({grade:'B30',steel:'CB400-V',b:300,h0:550,As:1500,Asp:0,ap:40,M:200});
  assert.equal(r.ok,true); assert.equal(r.pass,true);
  assert.ok(Math.abs(r.xMm-102.94117647058823)<1e-9);
  assert.ok(Math.abs(r.MuKnM-261.72794117647055)<1e-9);
});

test('TCVN5574 T-section flexure detects compression flange CT36',()=>{
  const r=calcBendingT5574({grade:'B30',steel:'CB400-V',b:300,bf:600,hf:120,h0:550,As:2500,Asp:0,ap:40,M:300});
  assert.equal(r.ok,true); assert.equal(r.flangeCompressionOnly,true); assert.equal(r.pass,true);
  assert.ok(Math.abs(r.MuKnM-443.71936274509807)<1e-9);
});

test('TCVN5574 eccentric compression CT40-43 benchmark',()=>{
  const r=calcEccentricRect5574({grade:'B30',steel:'CB400-V',b:300,h:500,h0:450,As:1800,Asp:800,ap:40,N:1200,M:180,L:3,determinate:false});
  assert.equal(r.ok,true); assert.equal(r.pass,true); assert.equal(r.eta,1);
  assert.ok(Math.abs(r.eaMm-16.666666666666668)<1e-9);
  assert.ok(Math.abs(r.lhsKnM-426)<1e-9);
  assert.ok(Math.abs(r.rhsKnM-547.9750669588508)<1e-9);
});

test('TCVN5574 determinate eccentricity adds ea, indeterminate takes max',()=>{
  const base={grade:'B30',steel:'CB400-V',b:300,h:500,h0:450,As:1800,Asp:800,ap:40,N:1200,M:180,L:3};
  const a=calcEccentricRect5574({...base,determinate:false});
  const b=calcEccentricRect5574({...base,determinate:true});
  assert.ok(Math.abs(a.e0Mm-150)<1e-12);
  assert.ok(Math.abs(b.e0Mm-(150+16.666666666666668))<1e-9);
});

test('Router selects and computes TCVN5574 eccentric workflow',()=>{
  const q='Tính nén lệch tâm cột BTCT B30 CB400-V b=300mm h=500mm h0=450mm As=1800mm2 Asp=800mm2 ap=40mm N=1200kN M=180kN.m L=3m';
  const x=solveEngineeringQuestion(q); assert.equal(x.workflow.id,'5574-eccentric'); assert.equal(x.workflow.status,'VERIFIED'); assert.equal(x.result.ok,true);
  const p=engineeringExcelPayload(q); assert.equal(p.input.grade,'B30'); assert.equal(p.input.N,1200);
});

test('TCVN5574 shear CT88/93-96 deterministic benchmark',()=>{
  const r=calcShear5574({grade:'B30',steel:'CB400-V',b:300,h0:450,Q:200,Asw:100,sw:150,a:1000});
  assert.equal(r.ok,true); assert.equal(r.QstripKn>=r.inputs.Q,true); assert.equal(r.pass,false);
  assert.ok(Math.abs(r.QstripKn-688.5)<1e-9);
  assert.ok(Math.abs(r.QuKn-171.328125)<1e-6);
});

test('TCVN5574 pure torsion CT102/107/109/111-113 benchmark',()=>{
  const r=calcTorsion5574({grade:'B30',steel:'CB400-V',b:300,h:500,T:50,Asw1:400,sw:150,As1:1000,Z1:260,Z2:460});
  assert.equal(r.ok,true); assert.equal(r.ratioPass,true); assert.equal(r.pass,true);
  assert.ok(Math.abs(r.TstripKnM-76.5)<1e-9);
});

test('TCVN5574 local compression CT116-118 benchmark',()=>{
  const r=calcLocalCompression5574({grade:'B30',N:1000,AbLoc:40000,AbMax:160000,psi:1});
  assert.equal(r.ok,true); assert.equal(r.pass,true);
  assert.ok(Math.abs(r.phiB-1.6)<1e-12); assert.ok(Math.abs(r.NuKn-1088)<1e-9);
});

test('TCVN5574 punching CT123-128 benchmark',()=>{
  const r=calcPunching5574({grade:'B30',steel:'CB400-V',F:500,u:3000,h0:180,Asw:100,sw:150});
  assert.equal(r.ok,true); assert.equal(r.pass,true);
  assert.ok(Math.abs(r.FbuKn-621)<1e-9); assert.ok(Math.abs(r.FuKn-1069)<1e-9);
});

test('Deep TCVN5574 modules status after serviceability/prestress pass',()=>{
  for(const id of ['5574-crack','5574-deformation','5574-prestress']) assert.equal(WORKFLOW_REGISTRY.find(x=>x.id===id)?.status,'VERIFIED');
  // Later passes may promote deep modules, but they must remain registered and never disappear.
  for(const id of ['5574-anchorage','5574-lap-splice','5574-circular','5574-corbel']) assert.ok(['REVIEW','VERIFIED','VERIFIED BRANCH'].includes(WORKFLOW_REGISTRY.find(x=>x.id===id)?.status));
});

test('AI to Excel wiring includes dedicated 5574 exporter',()=>{
  const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const excel=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(main,/export5574WorkflowWorkbook/); assert.match(main,/5574-eccentric/); assert.match(excel,/03 · DIỄN GIẢI TỪNG BƯỚC/); assert.match(excel,/06 · NGUỒN \/ PROVENANCE/);
});
