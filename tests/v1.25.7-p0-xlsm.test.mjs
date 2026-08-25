import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePileGeometry } from '../src/pile-geometry-engine.js';
import { findLayerAtDepth, splitBoreholeInterval, boreholeCoverageAudit } from '../src/borehole-engine.js';
import { calculateDrivenPile10304 } from '../src/pile-workflows.js';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);

test('P0 XLSM: visible 7.2.1 geometry benchmark is reproduced without XLL',()=>{
  const g=calculatePileGeometry({shape:'circle',diameterM:1,tipInnerDiameterM:0,massInnerDiameterM:0,headCoordinateM:15,tipCoordinateM:43.2});
  near(g.lengthM,28.2);
  near(g.tipAreaM2,Math.PI/4);
  near(g.perimeterM,Math.PI);
  near(g.secondMomentM4,Math.PI/64);
  assert.equal(g.verification.status,'VERIFIED');
});

test('P0 XLSM: Di_tip and Di_mass remain independent',()=>{
  const g=calculatePileGeometry({shape:'circle',diameterM:1,tipInnerDiameterM:.4,massInnerDiameterM:.6,lengthM:20,unitWeightKnM3:25});
  near(g.tipAreaM2,Math.PI*(1-.4**2)/4);
  near(g.concreteAreaM2,Math.PI*(1-.6**2)/4);
  assert.notEqual(g.tipAreaM2,g.concreteAreaM2);
  near(g.volumeM3,g.concreteAreaM2*20);
  near(g.selfWeightKn,g.volumeM3*25);
});

test('P0 XLSM: borehole boundary policy is explicit',()=>{
  const layers=[{index:1,top:0,bottom:3,name:'L1'},{index:2,top:3,bottom:8,name:'L2'}];
  assert.equal(findLayerAtDepth(layers,3,{boundaryPolicy:'deeper'}).name,'L2');
  assert.equal(findLayerAtDepth(layers,3,{boundaryPolicy:'shallower'}).name,'L1');
});

test('P0 XLSM: shaft interval excludes material above pile head and keeps <=2m segments',()=>{
  const layers=[{index:1,top:0,bottom:20,soilGroup:'clay',IL:.5},{index:2,top:20,bottom:50,soilGroup:'clay',IL:.4}];
  const segs=splitBoreholeInterval(layers,{startDepthM:15,endDepthM:43.2,maxSegmentM:2});
  assert.equal(segs[0].top,15);
  near(segs.at(-1).bottom,43.2);
  assert.ok(segs.every(x=>x.top>=15-1e-12&&x.hM<=2+1e-12));
  const audit=boreholeCoverageAudit(layers,{startDepthM:15,endDepthM:43.2});
  assert.equal(audit.ok,true);
  near(audit.coveredM,28.2);
});

test('P0 XLSM: driven 10304 accepts an explicit shaft start without changing legacy default',()=>{
  const base={shape:'square',sideM:.4,lengthM:12,tipDepthM:12,method:'hammer',layers:[{top:0,bottom:15,soilGroup:'clay',IL:.5}],gammaK:1.4};
  const full=calculateDrivenPile10304(base);
  const clipped=calculateDrivenPile10304({...base,shaftStartDepthM:2});
  assert.equal(full.ok,true); assert.equal(clipped.ok,true);
  assert.ok(clipped.sideResistanceKn < full.sideResistanceKn);
  assert.ok(clipped.segmentResults.every(x=>x.top>=2-1e-12));
  assert.equal(clipped.shaftStartDepthM,2);
});

test('P0 XLSM: driven segment size is configurable only inside verified <=2m envelope',()=>{
  const input={shape:'square',sideM:.4,lengthM:12,tipDepthM:12,shaftStartDepthM:1,method:'hammer',layers:[{top:0,bottom:15,soilGroup:'clay',IL:.5}]};
  const one=calculateDrivenPile10304({...input,maxSegmentM:1});
  const two=calculateDrivenPile10304({...input,maxSegmentM:2});
  const invalid=calculateDrivenPile10304({...input,maxSegmentM:2.1});
  assert.equal(one.ok,true); assert.equal(two.ok,true);
  assert.equal(one.maxSegmentM,1); assert.equal(one.segmentResults.length,11);
  assert.equal(two.maxSegmentM,2); assert.equal(two.segmentResults.length,6);
  assert.equal(invalid.ok,false);
  assert.match(invalid.missing.join(' '),/≤ 2 m/);
});


test('P0 XLSM: driven Formula-Only Excel mirrors shaft start and max segment inputs',()=>{
  const excel=readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(excel,/Độ sâu bắt đầu ma sát thân/);
  assert.match(excel,/Bước phân đoạn tối đa/);
  assert.match(excel,/MAX\('02_DIA_CHAT'!B\$\{raw\},'01_INPUT'!B14\)/);
  assert.match(excel,/C\$\{sr\}\+'01_INPUT'!B15/);
  assert.match(excel,/formulae:\[0\.000001,2\]/);
});
