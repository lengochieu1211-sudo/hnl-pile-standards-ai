import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupRockKs10304, lookupTable8Qb10304, lookupSptTipResistance10304, lookupSptShaftResistance10304 } from '../src/tcvn10304-table-engine.js';
import { calculateSptPile10304 } from '../src/pile-workflows.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const ev=JSON.parse(fs.readFileSync(path.resolve(here,'../artifacts/dce-udf-behavioral/dce-udf-observed-v1.25.7.json'),'utf8'));
const close=(a,b,t=1e-8)=>Math.abs(Number(a)-Number(b))<=t;
const num=x=>typeof x==='number'&&Number.isFinite(x);
function lerp(points,z){
  const ps=points.map(p=>[Number(p.depthM),Number(p.N)]).sort((a,b)=>a[0]-b[0]);
  for(const [x,y] of ps)if(Math.abs(z-x)<1e-10)return y;
  for(let i=0;i<ps.length-1;i++){const [x1,y1]=ps[i],[x2,y2]=ps[i+1];if(z>x1&&z<x2)return y1+(z-x1)*(y2-y1)/(x2-x1);}
  return null;
}

test('DCE NoiSuySPT cached diagnostics are fully reproduced by piecewise linear reference behavior',()=>{
  const rows=ev.sptScenario.diagnostics.filter(x=>num(x.NInterpolated));
  assert.ok(rows.length>=50);
  for(const r of rows) assert.ok(close(r.NInterpolated,lerp(ev.sptScenario.sptPoints,r.depthM),1e-9),`row ${r.row}`);
});

test('DCE qb_SPT2025 exposed values map to independent Appendix D HNL primitive for bored pile',()=>{
  for(const r of ev.sptScenario.diagnostics){
    if(!num(r.NInterpolated))continue;const clay=r.dceSoilGroup==='Đất dính';const observed=clay?r.qbClayKpa:r.qbSandKpa;if(!num(observed))continue;
    const h=lookupSptTipResistance10304({pileType:'bored',soilGroup:clay?'clay':'sand',N:r.NInterpolated,cuKpa:clay?6.25*r.NInterpolated:null});
    assert.ok(close(observed,h.value),`qb row ${r.row}`);
  }
});

test('DCE flu_SPT2025 unit f maps to independent Appendix D HNL primitive',()=>{
  for(const r of ev.sptScenario.diagnostics){
    if(!num(r.NInterpolated))continue;const clay=r.dceSoilGroup==='Đất dính';const observed=clay?r.fClayKpa:r.fSandKpa;if(!num(observed))continue;
    const h=lookupSptShaftResistance10304({pileType:'bored',soilGroup:clay?'clay':'sand',N:r.NInterpolated});
    assert.ok(close(observed,h.value),`f row ${r.row}`);
  }
});

test('DCE flu cumulative cached behavior is right-end rectangle on generated diagnostic intervals',()=>{
  let sum=0;let n=0;
  for(const r of ev.sptScenario.diagnostics){const clay=r.dceSoilGroup==='Đất dính';const f=clay?r.fClayKpa:r.fSandKpa;if(!num(r.segmentLengthM)||!num(f)||!num(r.fluCumulativeKn))continue;sum+=ev.sptScenario.perimeterM*r.segmentLengthM*f;n++;assert.ok(close(sum,r.fluCumulativeKn,2e-8),`flu row ${r.row}`);}
  assert.ok(n>=50);
});

test('GetKsFromRQD direct cached observation RQD=30 matches PDF Bảng 1 engine',()=>{
  const o=ev.rockKsDirectObservation,h=lookupRockKs10304(o.RQD);assert.equal(o.RQD,30);assert.ok(close(o.Ks,0.24,1e-12));assert.ok(close(o.Ks,h.value,1e-12));
});

test('GetQbBang8 indirect DCE diagnostics match HNL Bảng 8 but do not unlock proprietary UDF',()=>{
  assert.ok(ev.table8IndirectObservations.length>=3);
  for(const o of ev.table8IndirectObservations){const h=lookupTable8Qb10304({depthM:o.depthM,IL:o.IL});assert.ok(close(o.qbKpa,h.value),`${o.depthM}/${o.IL}`);}
  assert.equal(productionStatusFor('xll-GetQbBang8').productionNumeric,false);
});

test('full SPT scenario keeps the DCE vs HNL shaft policy difference explicit instead of silently cloning NoiSuySPT',()=>{
  const s=ev.sptScenario;
  const result=calculateSptPile10304({pileType:'bored',diameterM:s.diameterM,areaM2:s.areaM2,perimeterM:s.perimeterM,shaftStartDepthM:s.shaftStartDepthM,tipDepthM:s.tipDepthM,lengthM:s.lengthM,
    layers:s.soilLayers.map(x=>({top:x.topDepthM,bottom:x.bottomDepthM,soilGroup:x.soilGroup})),sptPoints:s.sptPoints.map(x=>({depthM:x.depthM,N:x.N})),gammaK:s.gammaK,gammaN:s.gammaN});
  assert.equal(result.ok,true);assert.equal(result.noInterpolationPolicy,true);
  assert.ok(close(result.RubKn,s.QbKn,1e-6),'tip should coincide in this benchmark');
  const dceRuf=s.fluAtTipKn-s.fluAtHeadKn;
  assert.equal(result.sptDataPolicy?.decision,'PDF-DECISION-LOCKED');
  assert.ok(Math.abs(result.RufKn-dceRuf)>100,'shaft policies remain visibly different by locked normative policy; DCE interpolation is reference-only');
});

test('EQ gamma cached tuples remain REVIEW and cannot unlock Production numeric output',()=>{
  assert.ok(ev.eqGammaUniqueObservations.length>=5);
  for(const id of ['xll-TinhGammaqbCMS','xll-TinhGammafiCMS','10304-seismic-eq']){const s=productionStatusFor(id);assert.equal(s.productionNumeric,false);assert.equal(s.status,'REVIEW');}
});
