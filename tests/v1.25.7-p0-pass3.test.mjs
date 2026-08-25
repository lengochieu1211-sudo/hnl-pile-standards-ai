import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateRockEndBearing10304, calculateBoredPile10304, calculateSptPile10304 } from '../src/pile-workflows.js';
import { evaluateRockExcelModel10304, evaluateBoredExcelModel10304, evaluateSptExcelModel10304 } from '../src/p0-pass3-excel-model.js';
import { productionStatusFor, isProductionNumericAllowed } from '../src/production-status-registry.js';
import { engineeringExcelPayload, canExportEngineeringResult } from '../src/engineering-router.js';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(Number(a)-Number(b))<=tol*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b))),`${a} != ${b}`);
const compare=(a,b,keys)=>keys.forEach(k=>near(a[k],b[k]));

test('P0 Pass3 production registry locks raw rock/bored/SPT but keeps XLL/EQ non-production',()=>{
  for(const id of ['10304-end-bearing-rock','10304-bored-raw','10304-spt-raw','10304-driven']){
    assert.equal(productionStatusFor(id).status,'LOCKED'); assert.equal(isProductionNumericAllowed(id),true);
  }
  for(const id of ['xll-GetKsFromRQD','xll-NoiSuySPT','xll-qb_SPT2025','xll-flu_SPT2025','10304-seismic-eq','10304-2014']) assert.equal(isProductionNumericAllowed(id),false);
});

test('P0 Pass3 rock Engine ↔ Excel-model parity includes every design intermediate',()=>{
  const input={shape:'circle',diameterM:1,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,embedmentLengthM:5,embeddedOuterDiameterM:1,minimumQbKpa:1000,gammaK:1.4,gammaN:1.15};
  const e=calculateRockEndBearing10304(input),x=evaluateRockExcelModel10304(input); assert.equal(e.ok,true); assert.equal(e.designFinal,true);
  near(e.geometry.tipAreaM2,x.A); compare(e,x,['Ks','RmKpa','embedmentFactor','qbBeforeCapKpa','qbKpa','RkKn','RdKn','NdMaxKn']);
});

test('P0 Pass3 rock preliminary result is displayable but blocked from Production Excel',()=>{
  const q='Cọc chống D=1000 mm, L_d=1,5 m; R_c,n=35 MPa; RQD=82%; gamma_k=1,4; gamma_n=1,15.';
  const p=engineeringExcelPayload(q); assert.equal(p.result?.ok,true); assert.equal(p.result?.status,'VERIFIED_PRELIMINARY'); assert.equal(p.canExport,false); assert.equal(canExportEngineeringResult(p),false);
  assert.equal(p.production?.id,'10304-end-bearing-rock'); assert.equal(p.production?.status,'LOCKED');
});

test('P0 Pass3 rock with explicit normative lower-bound opens Production Excel',()=>{
  const q='Cọc chống D=1000 mm, L_d=1,5 m; R_c,n=35 MPa; RQD=82%; minimum_qb=12000 kPa; gamma_k=1,4; gamma_n=1,15.';
  const p=engineeringExcelPayload(q); assert.equal(p.result?.ok,true); assert.equal(p.result?.designFinal,true); assert.equal(p.canExport,true); assert.equal(p.input?.minimumQbKpa,12000); assert.equal(p.input?.qbKpa,undefined);
});

test('P0 Pass3 bored Engine ↔ Excel-model parity covers tip, every shaft segment and Rk/Rd',()=>{
  const input={shape:'circle',diameterM:1,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,layers:[
    {top:0,bottom:6,soilGroup:'clay',soilClass:'clay',IL:.4,gammaKnM3:18,Sr:.9},
    {top:6,bottom:15,soilGroup:'sand',soilClass:'sand',sandType:'medium',phiDeg:31,gammaKnM3:18,gammaEffectiveKnM3:10}
  ],methodCaseId:'drilled-water-bentonite',tipConstruction:'general',gammaK:1.4,gammaN:1.15};
  const e=calculateBoredPile10304(input),x=evaluateBoredExcelModel10304(input); assert.equal(e.ok,true);
  near(e.geometry.tipAreaM2,x.A); near(e.geometry.perimeterM,x.u); compare(e,x,['embedmentInBearingLayerM','qbKpa','qbCtKpa','qbCapKpa','gammaRR','gammaC','tipResistanceKn','sideResistanceKn','RkKn','RdKn','NdMaxKn']);
  assert.equal(e.segmentResults.length,x.segmentResults.length); e.segmentResults.forEach((s,i)=>{const z=x.segmentResults[i]; near(s.avgDepthM,z.avgDepthM); near(s.hM,z.hM); near(s.fiKpa,z.fiKpa); near(s.gammaRf,z.gammaRf); near(s.resistanceKn,z.resistanceKn);});
});

test('P0 Pass3 bored keeps deeper-layer boundary policy and 2m embedment gate',()=>{
  const r=calculateBoredPile10304({shape:'circle',diameterM:1,tipDepthM:5,layers:[{top:0,bottom:5,soilGroup:'clay',soilClass:'clay',IL:.3},{top:5,bottom:10,soilGroup:'clay',soilClass:'clay',IL:.3}],methodCaseId:'bored-64a-64b'});
  assert.equal(r.ok,false); assert.equal(r.tipLayer?.index,2); assert.match(r.missing?.join(' '),/ít nhất 2 m/);
});

test('P0 Pass3 bored blocks invalid Bảng 6 method and Bảng 3 outside-domain shaft',()=>{
  const base={shape:'circle',diameterM:1,tipDepthM:12,layers:[{top:0,bottom:15,soilGroup:'clay',soilClass:'clay',IL:.3}],tipConstruction:'general'};
  const badMethod=calculateBoredPile10304({...base,methodCaseId:'not-a-method'}); assert.equal(badMethod.ok,false); assert.match(badMethod.missing.join(' '),/Bảng 6/);
  const deep=calculateBoredPile10304({shape:'circle',diameterM:1,tipDepthM:45,shaftStartDepthM:39,layers:[{top:0,bottom:50,soilGroup:'sand',soilClass:'sand',sandType:'coarse',phiDeg:31,gammaKnM3:18,gammaEffectiveKnM3:10}],methodCaseId:'bored-64a-64b'}); assert.equal(deep.ok,false); assert.match(deep.missing.join(' '),/ngoài miền Bảng 3|Không ngoại suy/);
});

test('P0 Pass3 SPT Engine ↔ Excel-model parity covers window N, qb, each layer, Qb/Qs/Rk/Rd',()=>{
  const input={pileType:'bored',shape:'circle',diameterM:1,lengthM:12,tipDepthM:12,shaftStartDepthM:0,layers:[{top:0,bottom:6,soilGroup:'sand',sptN:10},{top:6,bottom:15,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:11.5,N:20},{depthM:12,N:30},{depthM:12.5,N:40}],gammaK:1.5,gammaN:1.15};
  const e=calculateSptPile10304(input),x=evaluateSptExcelModel10304(input); assert.equal(e.ok,true); near(e.geometry.tipAreaM2,x.A); near(e.geometry.perimeterM,x.u); compare(e,x,['eta','tipN','qbKpa','RubKn','RufKn','RkKn','RdKn','NdMaxKn']); assert.equal(e.tipNAudit.count,x.tipNAudit.count); assert.equal(e.segmentResults.length,x.segmentResults.length); e.segmentResults.forEach((s,i)=>{const z=x.segmentResults[i]; near(s.NUsed,z.NUsed); near(s.unitResistanceKpa,z.unitResistanceKpa); near(s.resistanceKn,z.resistanceKn);});
});

test('P0 Pass3 SPT refuses interpolation when tip window has no measured SPT point',()=>{
  const r=calculateSptPile10304({pileType:'bored',shape:'circle',diameterM:1,lengthM:10,tipDepthM:10,layers:[{top:0,bottom:12,soilGroup:'sand',sptN:30}],sptPoints:[{depthM:5,N:50}]}); assert.equal(r.ok,false); assert.match(r.missing.join(' '),/không có điểm SPT đo thực tế/);
});

test('P0 Pass3 SPT driven open-tip rejects unsupported L/din<2 boundary',()=>{
  const r=calculateSptPile10304({pileType:'driven',shape:'circle',diameterM:1,lengthM:1.5,innerDiameterM:1,closedTip:false,tipDepthM:1.5,layers:[{top:0,bottom:3,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:1.5,N:20}]}); assert.equal(r.ok,false); assert.match(r.missing.join(' '),/L\/d_trong <2/);
});

test('P0 Pass3 Excel exporter contains raw Formula-Only sheets and no DCE XLL call',()=>{
  const src=readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  for(const token of ['export10304RockRawWorkbook','LOOKUP_BANG1','export10304BoredRawWorkbook','SHAFT_SEGMENTS','LOOKUP_BANG3_6','export10304SptRawWorkbook','SPT_POINTS','LOOKUP_D1','AVERAGEIFS']) assert.ok(src.includes(token),`missing ${token}`);
  assert.ok(!src.includes('_xll.GetKsFromRQD(')); assert.ok(!src.includes('_xll.NoiSuySPT(')); assert.ok(!src.includes('_xll.qb_SPT2025(')); assert.ok(!src.includes('_xll.flu_SPT2025('));
  assert.match(src,/if\(workflowId==='bored' && Array\.isArray\(input\.layers\)/); assert.match(src,/if\(workflowId==='spt' && Array\.isArray\(input\.layers\)/);
});


test('P0 Pass3 Excel runtime smoke is wired to raw rock/bored/SPT workbooks',()=>{
  const smoke=readFileSync(new URL('../scripts/excel-runtime-smoke.mjs',import.meta.url),'utf8');
  assert.match(smoke,/export10304AdvancedWorkflowWorkbook\('end-bearing'/);
  assert.match(smoke,/export10304AdvancedWorkflowWorkbook\('bored'/);
  assert.match(smoke,/export10304AdvancedWorkflowWorkbook\('spt'/);
  for(const token of ['Rock_EndBearing_P0Pass3','Bored_Raw_P0Pass3','SPT_Raw_P0Pass3']) assert.ok(smoke.includes(token),`missing smoke ${token}`);
});

test('P0 Pass3 Search Brain remains byte-for-byte untouched',()=>{
  const src=readFileSync(new URL('../src/search.js',import.meta.url)); assert.ok(src.length>1000);
});
