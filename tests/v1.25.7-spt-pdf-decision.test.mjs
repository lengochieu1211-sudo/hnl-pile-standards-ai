import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateSptPile10304 } from '../src/pile-workflows.js';
import { evaluateSptExcelModel10304 } from '../src/p0-pass3-excel-model.js';
import { averageMeasuredSptN10304, sptTipWindow10304 } from '../src/tcvn10304-table-engine.js';
import { productionStatusFor } from '../src/production-status-registry.js';

const near=(a,b,t=1e-9)=>assert.ok(Math.abs(Number(a)-Number(b))<=t,`${a} != ${b}`);
const base={pileType:'bored',shape:'circle',diameterM:1,lengthM:10,tipDepthM:10,shaftStartDepthM:0,gammaK:1.5,gammaN:1.15};

test('SPT PDF Decision: tip N is arithmetic mean of measured points in normative window and only tip mean is capped at 100',()=>{
  const w=sptTipWindow10304({pileType:'bored',tipDepthM:10,diameterM:1});
  assert.deepEqual([w.startDepthM,w.endDepthM],[9,11]);
  const a=averageMeasuredSptN10304([{depthM:8.9,N:1},{depthM:9,N:150},{depthM:10,N:120},{depthM:11,N:90},{depthM:11.1,N:1}],w);
  near(a.raw,120); near(a.value,100); assert.equal(a.count,3);
  const r=calculateSptPile10304({...base,layers:[{top:0,bottom:12,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:9,N:150},{depthM:10,N:120},{depthM:11,N:90}]});
  assert.equal(r.ok,true); near(r.tipN,100); near(r.tipNAudit.raw,120); assert.equal(r.sptDataPolicy.decision,'PDF-DECISION-LOCKED');
});

test('SPT PDF Decision: missing measured point in tip window BLOCKS instead of synthesizing NoiSuySPT',()=>{
  const r=calculateSptPile10304({...base,layers:[{top:0,bottom:12,soilGroup:'sand',sptN:30}],sptPoints:[{depthM:8,N:20},{depthM:12,N:40}]});
  assert.equal(r.ok,false); assert.match(r.missing.join(' '),/không có điểm SPT đo thực tế/);
});

test('SPT PDF Decision: shaft N is derived independently within each geological layer, never averaged across layers',()=>{
  const input={...base,layers:[{top:0,bottom:5,soilGroup:'sand'},{top:5,bottom:12,soilGroup:'sand'}],sptPoints:[{depthM:1,N:10},{depthM:4,N:20},{depthM:5,N:100},{depthM:8,N:40},{depthM:9.5,N:30},{depthM:10.5,N:30}]};
  const r=calculateSptPile10304(input); assert.equal(r.ok,true); assert.equal(r.segmentResults.length,2);
  near(r.segmentResults[0].NUsed,15); near(r.segmentResults[1].NUsed,(100+40+30)/3);
  assert.equal(r.segmentResults[0].NSource,'DERIVED-MEASURED-LAYER-MEAN');
  assert.equal(r.segmentResults[1].NSource,'DERIVED-MEASURED-LAYER-MEAN');
});

test('SPT PDF Decision: exact geological-boundary SPT point belongs only to deeper layer via [top,bottom)',()=>{
  const input={...base,layers:[{top:0,bottom:5,soilGroup:'sand'},{top:5,bottom:12,soilGroup:'sand'}],sptPoints:[{depthM:2,N:10},{depthM:5,N:100},{depthM:8,N:20},{depthM:9.5,N:30},{depthM:10.5,N:30}]};
  const e=calculateSptPile10304(input),x=evaluateSptExcelModel10304(input); assert.equal(e.ok,true);
  near(e.segmentResults[0].NUsed,10); near(e.segmentResults[1].NUsed,50);
  assert.deepEqual(e.segmentResults[0].NMeasuredPoints.map(p=>p.depthM),[2]);
  assert.deepEqual(e.segmentResults[1].NMeasuredPoints.map(p=>p.depthM),[5,8,9.5]);
  near(e.segmentResults[0].NUsed,x.segmentResults[0].NUsed); near(e.segmentResults[1].NUsed,x.segmentResults[1].NUsed);
});

test('SPT PDF Decision: shaft layer without representative N/cu or measured points BLOCKS instead of interpolating adjacent points',()=>{
  const input={...base,layers:[{top:0,bottom:5,soilGroup:'sand'},{top:5,bottom:12,soilGroup:'sand'}],sptPoints:[{depthM:8,N:20},{depthM:9.5,N:20},{depthM:10.5,N:20}]};
  const r=calculateSptPile10304(input); assert.equal(r.ok,false); assert.match(r.missing.join(' '),/Lớp 1.*N_s|N_s.*Lớp 1/);
});

test('SPT PDF Decision: shaft measured-layer N is NOT capped at 100; Table D.1 resistance cap remains responsible for capacity cap',()=>{
  const input={...base,layers:[{top:0,bottom:5,soilGroup:'sand'},{top:5,bottom:12,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:1,N:150},{depthM:4,N:200},{depthM:9.5,N:20},{depthM:10.5,N:20}]};
  const r=calculateSptPile10304(input); assert.equal(r.ok,true); near(r.segmentResults[0].NUsed,175); near(r.segmentResults[0].unitResistanceKpa,165);
  assert.equal(r.segmentResults[0].lookup.cap,165);
});

test('SPT PDF Decision: explicit layer representative N overrides raw measured points and records provenance',()=>{
  const input={...base,layers:[{top:0,bottom:5,soilGroup:'sand',sptN:25},{top:5,bottom:12,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:1,N:100},{depthM:4,N:120},{depthM:9.5,N:20},{depthM:10.5,N:20}]};
  const r=calculateSptPile10304(input); assert.equal(r.ok,true); near(r.segmentResults[0].NUsed,25); assert.equal(r.segmentResults[0].NSource,'REPORT-LAYER-REPRESENTATIVE'); assert.deepEqual(r.segmentResults[0].NMeasuredPoints,[]);
});

test('SPT PDF Decision: Production registry is LOCKED while DCE NoiSuySPT remains REFERENCE-only',()=>{
  const s=productionStatusFor('10304-spt-raw'),d=productionStatusFor('xll-NoiSuySPT');
  assert.equal(s.status,'LOCKED'); assert.equal(s.productionNumeric,true); assert.match(s.source,/PDF Decision Pass|no continuous/i);
  assert.equal(d.status,'REFERENCE'); assert.equal(d.productionNumeric,false);
});

test('SPT PDF Decision: Formula-Only Excel uses half-open shaft criteria and no shaft MIN(...,100)',()=>{
  const src=readFileSync(new URL('../src/excel-export.js',import.meta.url),'utf8');
  assert.match(src,/"<"&C\$\{rr\}/);
  assert.match(src,/mean SPT đo trong \[top,bottom\), không nội suy/);
  const shaftLine=src.split('\n').find(x=>x.includes("sh.getCell(`F${rr}`)")); assert.ok(shaftLine); assert.ok(!shaftLine.includes('MIN(AVERAGEIFS'));
});

test('SPT PDF Decision: Search Brain stays locked',()=>{
  const buf=readFileSync(new URL('../src/search.js',import.meta.url));
  const normalized=Buffer.from(buf.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
  assert.equal(createHash('sha256').update(normalized).digest('hex'),'f9b65e5e6fb61dcca233a4fe43950e3174c73536f2fa83452da3041fbd0021d2');
});
