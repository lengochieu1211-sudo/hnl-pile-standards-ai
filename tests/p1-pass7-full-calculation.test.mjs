import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runPass7FullCalculationWorkflow } from '../src/pass7-full-calculation-workflow.js';

const fixture=JSON.parse(fs.readFileSync('artifacts/p1-pass5-dce-table-bundle-fixture-v13.json','utf8'));
const csvDir=path.resolve('artifacts/p1-pass5-csv-fallback-v14');
const readCsv=(n)=>fs.readFileSync(path.join(csvDir,`${n}.csv`),'utf8');
const close=(a,b,t=1e-9)=>Math.abs(Number(a)-Number(b))<=Math.max(t,t*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))));

const material=(over={})=>({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,widthMm:400,heightMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long',...over});
const sandBh=(id,type,N1,N2,N3)=>({id,layers:[{top:0,bottom:4,soilGroup:'sand',sandType:type,sptN:N1},{top:4,bottom:9,soilGroup:'sand',sandType:type,sptN:N2},{top:9,bottom:15,soilGroup:'sand',sandType:type,sptN:N3}],sptPoints:[{depthM:10,N:N3-5},{depthM:11,N:N3},{depthM:12,N:N3+5},{depthM:13,N:N3},{depthM:14,N:N3-5}]});
const capacityInput=(over={})=>({mechanicalWorkflowId:'10304-driven',pileInput:{shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaN:1.15},mechanicalInput:{method:'hammer',gammaK:1.4},sptInput:{gammaK:1.5,pileType:'driven'},materialInput:material(),gammaN:1.15,boreholes:[sandBh('HK1','medium',18,24,30),sandBh('HK2','fine',10,15,20),sandBh('HK3','coarse',25,35,45)],...over});
const dceSource=()=>({kind:'DCE_TABLES',tables:fixture.tables,sourceId:'DCE_EXACT_PASS7_GOLDEN',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative'});
const csvSource=()=>({kind:'CSV',sourceId:'CSV_EXACT_PASS7_GOLDEN',unitsProfile:'kN_m_C',nodalReactionCompressionSign:'compression-positive',pierForceCompressionSign:'compression-negative',pointCoordinatesCsv:readCsv('pointCoordinates'),nodalReactionsCsv:readCsv('nodalReactions'),pointSpringAssignmentsCsv:readCsv('pointSpringAssignments'),pierForcesCsv:readCsv('pierForces'),pierSectionCsv:readCsv('pierSection')});

function run(source=dceSource(),cap=capacityInput()){
  return runPass7FullCalculationWorkflow({capacityInput:cap,structuralSource:source,sourceArtifact:'PASS7_GOLDEN_V18'});
}

test('Pass7 full chain reproduces locked Rsoil/Rmaterial/Rpile/Nd,max',()=>{
  const r=run();
  assert.ok(close(r.summary.RsoilKn,843.4285714285716));
  assert.ok(close(r.summary.RmaterialKn,2952));
  assert.ok(close(r.summary.RpileKn,843.4285714285716));
  assert.ok(close(r.summary.gammaN,1.15));
  assert.ok(close(r.summary.NdMaxPerPileKn,733.4161490683232));
  assert.equal(r.capacityBatch.criticalBoreholeId,'HK2');
  assert.equal(r.capacityBatch.criticalMethodId,'10304-driven');
});

test('Pass7 exposes all 6 borehole-method branches before structural check',()=>{
  const r=run();
  assert.equal(r.capacityBatch.rows.length,6);
  assert.equal(r.report.diaChat.length,6);
  assert.equal(r.report.diaChat.every(x=>x.QbKn>0&&x.QsKn>0&&x.RdKn>0&&x.RpileKn>0),true);
});

test('Pass7 structural result is 19/19 PASS and governing point 168',()=>{
  const r=run();
  assert.equal(r.structural.summary.pileCount,19);
  assert.equal(r.structural.summary.checkRows,19);
  assert.equal(r.structural.summary.passRows,19);
  assert.equal(r.structural.summary.overallPass,true);
  assert.equal(r.governing.pileId,'168');
  assert.equal(r.governing.combinationId,'EULS');
  assert.ok(close(r.governing.demandKn,365.2920507005818));
  assert.ok(close(r.governing.utilization,0.4980692764464232,1e-12));
  assert.equal(r.conclusion.statusVi,'ĐẠT');
});

test('Pass7 Vietnamese report model contains final engineering chain',()=>{
  const r=run();
  assert.match(r.report.tieuDe,/BÁO CÁO TÍNH TOÁN/);
  assert.equal(r.report.tongHop.loKhoanBatLoi,'HK2');
  assert.equal(r.report.tongHop.cocBatLoi,'168');
  assert.match(r.report.ketLuan,/ĐẠT:/);
  assert.match(r.report.ketLuan,/đất nền khống chế/i);
});

test('Pass7 DCE and CSV sources produce identical final engineering result',()=>{
  const a=run(dceSource()),b=run(csvSource());
  for(const k of ['RsoilKn','RmaterialKn','RpileKn','NdMaxPerPileKn','governingUtilization']) assert.ok(close(a.summary[k],b.summary[k],1e-12),k);
  assert.equal(a.governing.pileId,b.governing.pileId);
  assert.equal(a.conclusion.code,b.conclusion.code);
});

test('Pass7 blocks invalid material branch instead of creating Rpile',()=>{
  const bad=capacityInput({materialInput:material({shape:'circle'})});
  assert.throws(()=>run(dceSource(),bad),/Capacity branch blocked/);
});

test('Pass7 blocks incomplete borehole coverage before structural checking',()=>{
  const bad=capacityInput({boreholes:[sandBh('HK1','medium',18,24,30),{id:'HK2',layers:[{top:0,bottom:4,soilGroup:'sand',sandType:'fine',sptN:10},{top:6,bottom:15,soilGroup:'sand',sandType:'fine',sptN:20}],sptPoints:[{depthM:11,N:20},{depthM:12,N:25}]}]});
  assert.throws(()=>run(dceSource(),bad),/Capacity branch blocked/);
});

test('Pass7 provenance proves no manual capacity bypass',()=>{
  const r=run();
  assert.equal(r.provenance.soilMaterialCapacity,'P1 Pass 2 LOCKED child engines');
  assert.equal(r.provenance.structuralImporter,'P1 Pass 5 Core LOCKED');
  assert.equal(r.provenance.importedReactionCheck,'P1 Pass 4 numeric core LOCKED');
  assert.equal(r.capacity.sourceModule,'MultiBoreholePileEngine + PileCapacityEngine + PileMaterialEngine');
});
