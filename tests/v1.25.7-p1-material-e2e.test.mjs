import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateDrivenPile10304, calculateRockEndBearing10304, calculateBoredPile10304, calculateSptPile10304 } from '../src/pile-workflows.js';
import { calculateNearCenteredRectPileCapacity5574 } from '../src/pile-material-engine.js';
import { combineLockedPileResistance } from '../src/pile-capacity-engine.js';
import { evaluateIntegratedPileCapacityExcelModel } from '../src/p1-material-e2e-excel-model.js';
import { solveEngineeringQuestion, engineeringExcelPayload } from '../src/engineering-router.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const material=(over={})=>({grade:'B30',steel:'CB400-V',shape:'square',sideMm:400,widthMm:400,heightMm:400,AsTotMm2:1600,L0Mm:4000,e0Mm:400/30,e0IncludesRandom:true,reinforcementOppositeSides:true,loadDuration:'long',...over});
const layers=[{top:0,bottom:3,soilGroup:'clay',IL:.7},{top:3,bottom:8,soilGroup:'clay',IL:.5},{top:8,bottom:15,soilGroup:'clay',IL:.3}];
const driven={shape:'square',sideM:.4,lengthM:12,tipDepthM:12,method:'hammer',layers,gammaK:1.4,gammaN:1.15};

test('P1 Material E2E: locked driven soil + CT50 material produces governing and keeps gammaN after min',()=>{
  const s=calculateDrivenPile10304(driven),m=calculateNearCenteredRectPileCapacity5574(material());
  const g=combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:s,soilInput:driven,materialResult:m});
  assert.equal(g.ok,true); assert.equal(g.governing,'SOIL'); assert.equal(g.pileResistanceKn,s.RdKn); assert.ok(Math.abs(g.demandLimitKn-g.pileResistanceKn/1.15)<1e-12);
  assert.equal(g.capacityBasis,'DESIGN_RESISTANCE');
});

test('P1 Material E2E: manual/mixed or preliminary soil cannot unlock governing',()=>{
  const m=calculateNearCenteredRectPileCapacity5574(material());
  const mixed=combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:{ok:true,status:'MIXED/MANUAL',RdKn:2000,gammaK:1.4,geometry:{shape:'square',sideM:.4}},soilInput:driven,materialResult:m});
  assert.equal(mixed.ok,false); assert.match(mixed.issues.join(' '),/VERIFIED/);
  const prelim=calculateRockEndBearing10304({shape:'square',sideM:.4,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,embedmentLengthM:5,embeddedOuterDiameterM:.4,gammaK:1.4});
  assert.equal(prelim.status,'VERIFIED_PRELIMINARY');
  const gp=combineLockedPileResistance({soilWorkflowId:'10304-end-bearing',soilResult:prelim,soilInput:{shape:'square',sideM:.4},materialResult:m}); assert.equal(gp.ok,false);
});

test('P1 Material E2E: geometry mismatch and circular material path are blocked',()=>{
  const s=calculateDrivenPile10304(driven),m=calculateNearCenteredRectPileCapacity5574(material({sideMm:450,widthMm:450,heightMm:450,e0Mm:15}));
  const g=combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:s,soilInput:driven,materialResult:m}); assert.equal(g.ok,false); assert.match(g.issues.join(' '),/không đồng nhất/i);
});

test('P1 Material E2E independent Excel model matches engine composition for driven',()=>{
  const s=calculateDrivenPile10304(driven),m=calculateNearCenteredRectPileCapacity5574(material()),g=combineLockedPileResistance({soilWorkflowId:'10304-driven',soilResult:s,soilInput:driven,materialResult:m});
  const x=evaluateIntegratedPileCapacityExcelModel({soilWorkflowId:'10304-driven',soilInput:driven,materialInput:material()}); assert.equal(x.ok,true); assert.ok(Math.abs(x.soilResistanceKn-g.soilResistanceKn)<1e-9); assert.ok(Math.abs(x.materialResistanceKn-g.materialResistanceKn)<1e-9); assert.ok(Math.abs(x.pileResistanceKn-g.pileResistanceKn)<1e-9); assert.equal(x.governing,g.governing);
});

test('P1 Material E2E formula models cover rock, bored and SPT square branches',()=>{
  const cases=[
    ['10304-end-bearing',{shape:'square',sideM:.4,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,embedmentLengthM:5,embeddedOuterDiameterM:.4,minimumQbKpa:1000,gammaK:1.4,gammaN:1.15},calculateRockEndBearing10304],
    ['10304-bored',{shape:'square',sideM:.4,tipDepthM:12,shaftStartDepthM:12,maxSegmentM:1,layers:[{top:0,bottom:15,soilGroup:'clay',soilClass:'clay',IL:.3}],methodCaseId:'bored-64a-64b',gammaK:1.4,gammaN:1.15},calculateBoredPile10304],
    ['10304-spt',{pileType:'bored',shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:0,layers:[{top:0,bottom:6,soilGroup:'sand',sptN:10},{top:6,bottom:15,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:11.5,N:20},{depthM:12,N:30},{depthM:12.5,N:40}],gammaK:1.5,gammaN:1.15},calculateSptPile10304]
  ];
  for(const [id,input,fn] of cases){const s=fn(input);assert.equal(s.ok,true,id);const m=calculateNearCenteredRectPileCapacity5574(material()),g=combineLockedPileResistance({soilWorkflowId:id,soilResult:s,soilInput:input,materialResult:m});assert.equal(g.ok,true,id);const x=evaluateIntegratedPileCapacityExcelModel({soilWorkflowId:id,soilInput:input,materialInput:material()});assert.equal(x.ok,true,id);assert.ok(Math.abs(x.pileResistanceKn-g.pileResistanceKn)<1e-8,id);}
});

test('P1 Material E2E router recognizes explicit combined intent and exports only locked composition',()=>{
  const q='Kiểm cả đất và vật liệu cọc vuông 400x400 mm dài L=12 m đóng bằng búa, B30, CB400-V, As,tot=1600 mm2, L0=4 m, e0=13.333333 mm đã kể lệch tâm ngẫu nhiên ea, cốt dọc bố trí ở hai phía đối diện, tải dài hạn, gamma_k=1.4, gamma_n=1.15. Lớp 1: từ 0 m đến 3 m đất sét IL=0.7. Lớp 2: từ 3 m đến 8 m đất sét IL=0.5. Lớp 3: từ 8 m đến 15 m đất sét IL=0.3.';
  const p=engineeringExcelPayload(q); assert.equal(p.workflow.id,'pile-capacity-integrated'); assert.equal(p.result.ok,true); assert.equal(p.result.governing,'SOIL'); assert.equal(p.canExport,true); assert.equal(p.production.id,'pile-capacity-integrated-square');
  assert.equal(p.input.soilWorkflowId,'10304-driven'); assert.equal(p.input.materialInput.sideMm,400);
});

test('P1 Material E2E decimal-dot e0 still detects random-eccentricity proof',()=>{
  const q='SCT VatLieu cọc vuông 400x400 mm B30 CB400-V As,tot=1600 mm2 L0=4 m e0=13.333333 mm đã kể lệch tâm ngẫu nhiên ea, cốt dọc bố trí ở hai phía đối diện, tải dài hạn';
  const p=solveEngineeringQuestion(q); assert.equal(p.workflow.id,'5574-pile-material'); assert.equal(p.result.ok,true);
});

test('P1 Material E2E Production registry is locked and EQ stays review',()=>{
  assert.equal(productionStatusFor('pile-capacity-integrated-square').status,'LOCKED'); assert.equal(productionStatusFor('pile-capacity-integrated-square').productionNumeric,true); assert.equal(productionStatusFor('10304-seismic-eq').productionNumeric,false);
});

test('P1 Material E2E exporter reuses soil formula workbook and appends formula-only governing',()=>{
  const src=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8'); assert.match(src,/exportIntegratedPileCapacityWorkbook/); assert.match(src,/returnBuffer/); assert.match(src,/MATERIAL_CALC/); assert.match(src,/PILE_GOVERNING/); assert.match(src,/MIN\(B2,B3\)/); assert.match(src,/Không tham gia phép min sức kháng/); assert.match(src,/XLSM SCT VatLieu/);
});
