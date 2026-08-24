import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcEmbeddedPlateAnchorsD5574, calcInclinedAnchorD75574, lookupAnnexLGamma5574,
  calcAnnexMVerticalLimit5574, calcAnnexMPsychophysicalDeflection5574,
  calcAnnexMGenericLimit5574, calcAnnexMCraneHorizontalLimit5574,
  calcAnnexMStructuralDrift5574, TCVN5574_ANNEX_INDEX
} from '../src/tcvn5574-core.js';
import { solveEngineeringQuestion, selectEngineeringWorkflow } from '../src/engineering-router.js';
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol, `${a} != ${b}`);

test('v1.22 Annex D D.1-D.4/D.6 verified branch benchmark',()=>{
  const r=calcEmbeddedPlateAnchorsD5574({grade:'B30',steel:'CB400-V',M:40,N:100,Q:150,z:400,nan:2,Aan:800,Qan0:200});
  assert.equal(r.ok,true); close(r.NanKn,150); close(r.NprimeKn,50); close(r.QanKn,67.5); close(r.Nan0Kn,280); close(r.utilization,0.8732142857142857); assert.equal(r.pass,true);
  assert.match(r.warnings.join(' '),/D\.5/);
});

test('v1.22 Annex D D.7 inclined anchor benchmark and angle gate',()=>{
  const r=calcInclinedAnchorD75574({steel:'CB400-V',Q:200,Nprime:50,angle:20}); assert.equal(r.ok,true); close(r.AanIncMm2,528.5714285714286);
  assert.equal(calcInclinedAnchorD75574({steel:'CB400-V',Q:200,Nprime:50,angle:10}).ok,false);
});

test('v1.22 Annex L Table L.1 verified rows 1-3',()=>{
  close(lookupAnnexLGamma5574({type:'rectangle'}).gamma,1.30);
  close(lookupAnnexLGamma5574({type:'t-compression'}).gamma,1.30);
  close(lookupAnnexLGamma5574({type:'t-tension',bf:500,b:300,hf:20,h:500}).gamma,1.25);
  close(lookupAnnexLGamma5574({type:'t-tension',bf:900,b:300,hf:120,h:500}).gamma,1.25);
  close(lookupAnnexLGamma5574({type:'t-tension',bf:900,b:300,hf:50,h:500}).gamma,1.20);
  assert.equal(lookupAnnexLGamma5574({type:'i-section'}).ok,false);
});

test('v1.22 Annex M vertical generic and Table M.1 branches',()=>{
  close(calcAnnexMGenericLimit5574({span:6}).fuMm,40);
  close(calcAnnexMGenericLimit5574({span:2,cantilever:true}).fuMm,26.666666666666668);
  close(calcAnnexMVerticalLimit5574({type:'crane-floor',L:10}).fuMm,40);
  close(calcAnnexMVerticalLimit5574({type:'crane-cabin',L:10,group:'A8'}).fuMm,16.666666666666668);
  close(calcAnnexMVerticalLimit5574({type:'visible-roof-floor',L:6,roomHeight:3}).fuMm,30);
  close(calcAnnexMVerticalLimit5574({type:'detachable-finishes',L:6}).fuMm,40);
  close(calcAnnexMVerticalLimit5574({type:'suspended-hoist-floor',L:6,a:3}).fuMm,20);
  close(calcAnnexMVerticalLimit5574({type:'free-slab-stair'}).fuMm,0.7);
  close(calcAnnexMVerticalLimit5574({type:'lintel-wall-panel',L:3}).fuMm,15);
});

test('v1.22 Annex M M.2/M.3/M.4 benchmarks',()=>{
  close(calcAnnexMPsychophysicalDeflection5574({p:1.5,p1:0.2,q:3,n:2,b:50}).fuMm,2.40140625);
  close(calcAnnexMCraneHorizontalLimit5574({group:'A4-A6',member:'indoor-column',h:12}).fuMm,12);
  close(calcAnnexMCraneHorizontalLimit5574({group:'A1-A3',member:'outdoor-column',h:3}).fuMm,6); // min 6 mm
  close(calcAnnexMStructuralDrift5574({type:'multistory',h:30}).fuMm,60);
  close(calcAnnexMStructuralDrift5574({type:'story-brick',connection:'rigid',hs:3}).fuMm,6);
  close(calcAnnexMStructuralDrift5574({type:'story-ceramic',hs:3.5}).fuMm,5);
  close(calcAnnexMStructuralDrift5574({type:'single-story',hs:15}).fuMm,75);
});

test('v1.22 Annex statuses are honest branches not blanket full verification',()=>{
  const by=Object.fromEntries(TCVN5574_ANNEX_INDEX.map(x=>[x.annex,x.status]));
  assert.equal(by.D,'VERIFIED_BRANCH'); assert.equal(by.L,'VERIFIED_PARTIAL'); assert.equal(by.M,'VERIFIED_PARTIAL');
});

test('v1.22 router selects and calculates D/L/M before generic routes',()=>{
  assert.equal(selectEngineeringWorkflow('Phụ lục D chi tiết đặt sẵn')?.id,'5574-annex-d');
  assert.equal(selectEngineeringWorkflow('Phụ lục L hệ số mô men kháng uốn đàn dẻo')?.id,'5574-annex-l');
  assert.equal(selectEngineeringWorkflow('Phụ lục M độ võng giới hạn')?.id,'5574-annex-m');
  const d=solveEngineeringQuestion('Phụ lục D chi tiết đặt sẵn B30 CB400-V M=40 kN.m N=100 kN Q=150 kN z=400 mm nan=2 Aan=800 mm2 Qan0=200 kN');
  assert.equal(d.result?.ok,true); close(d.result.utilization,0.8732142857142857);
  const l=solveEngineeringQuestion('Phụ lục L hệ số mô men kháng uốn chữ T cánh kéo bf=900 b=300 hf=50 h=500 mm');
  assert.equal(l.result?.ok,true); close(l.result.gamma,1.2);
  const m=solveEngineeringQuestion('Phụ lục M độ võng giới hạn nhịp L=6 m');
  assert.equal(m.result?.ok,true); close(m.result.fuMm,40);
});

test('v1.22 Excel exporter wires Annex D/L/M production branches',async()=>{
  const {readFile}=await import('node:fs/promises');
  const s=await readFile(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(s,/export5574AnnexDLMWorkbook/);
  assert.match(s,/5574-annex-d/); assert.match(s,/5574-annex-l/); assert.match(s,/5574-annex-m/);
  assert.match(s,/D\.1 utilization/); assert.match(s,/Bảng L\.1 mục 1–3/); assert.match(s,/fu M\.2/); assert.match(s,/Bảng M\.3/); assert.match(s,/Bảng M\.4/);
  assert.match(s,/HNL_TCVN5574_\$\{safeName\(workflowId\)\}_v1\.22\.0\.xlsx/);
});

test('v1.22 AI chat shows Excel button for verified 5574 branches and exporter no longer hardcodes old list',async()=>{
  const {readFile}=await import('node:fs/promises');
  const s=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(s,/TCVN 5574:2018/); assert.match(s,/startsWith\('VERIFIED'\)/);
  assert.doesNotMatch(s,/\['5574-material','5574-bending-rect','5574-eccentric','5574-shear','5574-torsion','5574-local','5574-punch'\]/);
});
