import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  lookupQb10304, lookupFi10304, splitSoilLayers10304
} from '../src/pile-workflows.js';
import {
  T10304_INTERPOLATION_POLICIES,
  lookupTable7Alphas10304, lookupTable8Qb10304,
  lookupTable12M10304, lookupTable15Beta1, lookupTable15SideBeta,
  lookupTable16Cpt10304, lookupTable17Mv10304,
  kvTable17Formula10304, zeta0Table17Formula10304
} from '../src/tcvn10304-table-engine.js';
import { epsB2ShortHeavy5574 } from '../src/tcvn5574-core.js';

const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);

test('v1.25.3 policy registry classifies audited TCVN 10304 tables',()=>{
  const by=Object.fromEntries(T10304_INTERPOLATION_POLICIES.map(x=>[x.table,x]));
  assert.match(by['Bảng 2'].mode,/BILINEAR-2D/);
  assert.match(by['Bảng 3'].mode,/BILINEAR-2D/);
  assert.equal(by['Bảng 6'].mode,'DISCRETE');
  assert.match(by['Bảng 7'].mode,/BILINEAR-2D/);
  assert.match(by['Bảng 8'].mode,/BILINEAR-2D/);
  assert.equal(by['Bảng 12'].mode,'DISCRETE');
  assert.match(by['Bảng 15'].mode,/EXACT/);
  assert.equal(by['Bảng 16'].mode,'LINEAR-1D');
  assert.match(by['Bảng 17'].mode,/LINEAR-1D/);
});

test('Bảng 2 q_b supports exact, bilinear interpolation, explicit z>40 plateau and blocks extrapolation',()=>{
  close(lookupQb10304({depthM:12,soilGroup:'clay',IL:0.3}).value,3700);
  close(lookupQb10304({depthM:12,soilGroup:'clay',IL:0.35}).value,3150);
  close(lookupQb10304({depthM:45,soilGroup:'sand',sandType:'coarse'}).value,10500);
  assert.throws(()=>lookupQb10304({depthM:2,soilGroup:'clay',IL:0.3}),/ngoài|dưới|nhỏ|biên/i);
  assert.throws(()=>lookupQb10304({depthM:12,soilGroup:'clay',IL:0.7}),/ngoài|lớn|nhỏ|biên/i);
});

test('Bảng 3 f_i uses bilinear interpolation and no depth extrapolation',()=>{
  close(lookupFi10304({avgDepthM:2.5,soilGroup:'clay',IL:0.7}).value,7.5);
  close(lookupFi10304({avgDepthM:4,soilGroup:'clay',IL:0.1}).value,53);
  assert.throws(()=>lookupFi10304({avgDepthM:41,soilGroup:'clay',IL:0.3}),/ngoài|lớn|nhỏ|biên/i);
  assert.throws(()=>lookupFi10304({avgDepthM:10,soilGroup:'clay',IL:1.1}),/ngoài|lớn|nhỏ|biên/i);
});

test('Bảng 3 workflow segmentation always respects <=2 m and layer boundaries',()=>{
  const seg=splitSoilLayers10304([
    {top:0,bottom:3,soilGroup:'clay',IL:.7},
    {top:3,bottom:8,soilGroup:'clay',IL:.5},
    {top:8,bottom:15,soilGroup:'clay',IL:.3},
  ],12,2);
  assert.ok(seg.length>3);
  assert.ok(seg.every(x=>x.hM<=2+1e-12));
  close(seg.reduce((s,x)=>s+x.hM,0),12);
  assert.ok(seg.some(x=>x.top===2 && x.bottom===3));
  assert.ok(seg.some(x=>x.top===7 && x.bottom===8));
});

test('Bảng 7 uses 1D/bilinear interpolation only inside permitted axes',()=>{
  const r=lookupTable7Alphas10304({phi:30,hdRatio:12,dM:1.2});
  close(r.alpha1,29.5);
  close(r.alpha2,54.75);
  close(r.alpha3,0.691,1e-12);
  close(r.alpha4,0.25875,1e-12);
  assert.throws(()=>lookupTable7Alphas10304({phi:40,hdRatio:12,dM:1.2}),/ngoài|lớn|nhỏ|biên/i);
  assert.throws(()=>lookupTable7Alphas10304({phi:30,hdRatio:3.9,dM:1.2}),/ngoài|lớn|nhỏ|biên/i);
  assert.throws(()=>lookupTable7Alphas10304({phi:30,hdRatio:12,dM:4.1}),/ngoài|lớn|nhỏ|biên/i);
});

test('Bảng 8 bilinear interpolation blocks sparse dash cells',()=>{
  close(lookupTable8Qb10304({depthM:16,IL:.35}).value,1266.6666666666667,1e-9);
  assert.throws(()=>lookupTable8Qb10304({depthM:35,IL:.55}),/trống|ô|nội suy|bảng/i);
});

test('Bảng 12 is discrete; dense sand rows use explicit +60 percent rule',()=>{
  close(lookupTable12M10304({soilId:'fine',dense:false}).value,1.1);
  close(lookupTable12M10304({soilId:'fine',dense:true}).value,1.76);
  assert.throws(()=>lookupTable12M10304({soilId:'unknown'}),/không|bảng/i);
});

test('Bảng 15 is exact/edge-band only: intermediate points require sourced override',()=>{
  close(lookupTable15Beta1({qs:5000,pile:'driven',load:'compression'}).value,.65);
  assert.throws(()=>lookupTable15Beta1({qs:6000,pile:'driven',load:'compression'}),/nội suy|mốc|bảng/i);
  close(lookupTable15SideBeta({fs:40,probe:'mechanical',soil:'clay'}).value,1);
  assert.throws(()=>lookupTable15SideBeta({fs:50,probe:'mechanical',soil:'clay'}),/nội suy|mốc|bảng/i);
});

test('Bảng 16 explicitly linearly interpolates qc only through numeric segments',()=>{
  close(lookupTable16Cpt10304({qc:6000,soil:'sand',component:'qb'}).value,980,1e-12);
  assert.throws(()=>lookupTable16Cpt10304({qc:22000,soil:'clay',component:'fi'}),/trống|ô|nội suy|biên/i);
});

test('Bảng 17 uses formulas for kv/zeta0 and local linear interpolation for mv without extrapolation',()=>{
  close(lookupTable17Mv10304(.325).value,1.646,1e-12);
  close(kvTable17Formula10304(.3),1.8822,1e-12);
  close(zeta0Table17Formula10304(.5),.25,1e-12);
  assert.throws(()=>lookupTable17Mv10304(.55),/ngoài|lớn|nhỏ|biên/i);
});

test('TCVN 5574 eps_b2 interpolation remains synchronized for B70-B100',()=>{
  close(epsB2ShortHeavy5574('B70'),.0033);
  close(epsB2ShortHeavy5574('B85'),.00305,1e-12);
  close(epsB2ShortHeavy5574('B100'),.0028);
});

test('Excel exporter mirrors table policy: segmentation, strict bounds, B15 no interpolation, B17 local interpolation',()=>{
  const excel=fs.readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(excel,/03_PHAN_DOAN/);
  assert.match(excel,/phân đoạn ≤2 m/);
  assert.match(excel,/NGOÀI BẢNG/);
  assert.match(excel,/Bảng 15: chỉ mốc đúng bảng\/miền ≤\/≥; không tự nội suy/);
  assert.match(excel,/TRUE,"CẦN β1"/);
  assert.match(excel,/Bảng 17: m_v nội suy tuyến tính trong 0≤ν≤0,5; không ngoại suy/);
  assert.doesNotMatch(excel,/FORECAST\.LINEAR/);
});
