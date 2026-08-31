import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildNormalizedSptGeometryInput, deriveSptSectionGeometry, parseSptPileLength, parseSptPileSection } from '../src/spt-shared-spec.js';
import { extractSptSummaryInputV26 } from '../src/engineering-input-interpreter.js';
import { calculateSptSummary10304, calculateSptPile10304 } from '../src/pile-workflows.js';
import { export10304AdvancedWorkflowWorkbook } from '../src/excel-export-compat.js';

const near=(actual,expected,tol=1e-8,msg='')=>assert.ok(Math.abs(actual-expected)<=tol,`${msg} expected ${expected}, got ${actual}`);
const base={inputMode:'EXPLICIT_SPT_SUMMARY',pileType:'driven',sectionType:'square',widthM:.4,heightM:.4,sideM:.4,lengthM:10,shaftStartDepthM:0,shaftLengthM:10,soilGroup:'sand',nBarTip:20,nsShaft:20,eta:1,closedTip:true,gammaK:1.5,gammaN:1.15};

function labelRow(ws,label){for(let r=1;r<=ws.rowCount;r++)if(String(ws.getCell(r,1).value??'').trim()===label)return r;return null;}

test('SPT parser: 8 required length/geometry phrasings normalize deterministically',()=>{
  const phrases=[
    'Chiều dài cọc: 10 m','Chiều dài = 10m','L = 10 m','L=10000 mm','Cọc dài 10 m',
    'Cọc BTCT 400x400, dài 10m','Cọc 400×400×10000 mm','Cọc vuông cạnh 400 mm, dài 10 m'
  ];
  for(const text of phrases){
    const g=buildNormalizedSptGeometryInput(text,{sectionType:'square',widthM:.4,heightM:.4,sideM:.4});
    near(g.lengthM,10,1e-12,text);
    const sec=parseSptPileSection(text);
    if(sec){near(sec.widthM,.4,1e-12,text);near(sec.heightM,.4,1e-12,text);assert.equal(sec.sectionType,'square');}
  }
  near(parseSptPileLength('L=10000 mm').lengthM,10);
  assert.equal(parseSptPileSection('Cọc BTCT 400x400, dài 10m').unitAssumption,'PILE_SECTION_BARE_DIMENSIONS_GE_100_ARE_MM');
});

test('SPT interpreter exposes normalized source geometry and mm->m length',()=>{
  const x=extractSptSummaryInputV26('SPT cọc ép BTCT 400×400×10000 mm, đất cát, mũi kín, eta=1, Nbar=20, Ns trên toàn thân cọc=20, gamma_k=1.5, gamma_n=1.15');
  assert.equal(x.sectionType,'square'); near(x.widthM,.4); near(x.heightM,.4); near(x.lengthM,10);
  assert.equal(x.pileType,'driven'); assert.equal(x.soilGroup,'sand'); assert.equal(x.fullShaft,true);
});

test('Geometry source-of-truth: square/rectangle/circle derive A and u',()=>{
  const sq=deriveSptSectionGeometry({sectionType:'square',widthM:.4,heightM:.4}); near(sq.areaM2,.16);near(sq.perimeterM,1.6);
  const rect=deriveSptSectionGeometry({sectionType:'rectangle',widthM:.4,heightM:.6}); near(rect.areaM2,.24);near(rect.perimeterM,2.0);
  const cir=deriveSptSectionGeometry({sectionType:'circle',diameterM:.6}); near(cir.areaM2,Math.PI*.36/4);near(cir.perimeterM,Math.PI*.6);
  assert.throws(()=>deriveSptSectionGeometry({sectionType:'square',widthM:-.4,heightM:-.4}),/> 0 m/);
});

test('SPT basic Golden: engine derives geometry and full resistance chain',()=>{
  const r=calculateSptSummary10304({...base,areaM2:999,perimeterM:999});
  assert.equal(r.ok,true); near(r.geometry.areaM2,.16);near(r.geometry.perimeterM,1.6);
  near(r.qbKpa,6000);near(r.shaftUnitResistanceKpa,40);near(r.RubKn,960);near(r.RufKn,640);near(r.RkKn,1600);near(r.RcKKn,1600);near(r.RdKn,1600/1.5);near(r.NdMaxKn,1600/1.5/1.15);
});

test('SPT cap rules: qb <= 18000 and fs <= 100',()=>{
  const r=calculateSptSummary10304({...base,nBarTip:80,nsShaft:70});
  assert.equal(r.ok,true);near(r.qbKpa,18000);near(r.shaftUnitResistanceKpa,100);
  assert.ok(r.qbLookup.raw>r.qbKpa);assert.ok(r.shaftLookup.raw>r.shaftUnitResistanceKpa);
});

test('SPT section changes propagate deterministically in Engine',()=>{
  const r300=calculateSptSummary10304({...base,widthM:.3,heightM:.3,sideM:.3});
  near(r300.geometry.areaM2,.09);near(r300.geometry.perimeterM,1.2);near(r300.RubKn,540);near(r300.RufKn,480);
  const rc=calculateSptSummary10304({...base,sectionType:'circle',shape:'circle',widthM:null,heightM:null,sideM:null,diameterM:.6});
  near(rc.geometry.areaM2,Math.PI*.6*.6/4);near(rc.geometry.perimeterM,Math.PI*.6);
});

test('SPT validation blocks missing/negative primary geometry or length',()=>{
  assert.equal(calculateSptSummary10304({...base,widthM:null,heightM:null,sideM:null}).ok,false);
  assert.equal(calculateSptSummary10304({...base,lengthM:-10,shaftLengthM:-10}).ok,false);
});

test('SPT multi-layer uses per-layer u*sum(fi*li), not one whole-shaft Ns',()=>{
  const input={pileType:'driven',sectionType:'square',widthM:.4,heightM:.4,lengthM:10,tipDepthM:10,shaftStartDepthM:0,closedTip:true,eta:1,
    layers:[
      {top:0,bottom:4,soilGroup:'sand',sptN:10},
      {top:4,bottom:8,soilGroup:'sand',sptN:30},
      {top:8,bottom:11,soilGroup:'sand',sptN:50}
    ],
    sptPoints:[{depthM:8.5,N:40},{depthM:9.5,N:50},{depthM:10.5,N:60}]
  };
  const r=calculateSptPile10304(input); assert.equal(r.ok,true);
  const expected=r.geometry.perimeterM*r.segmentResults.reduce((sum,x)=>sum+x.unitResistanceKpa*x.hM,0);
  near(r.RufKn,expected,1e-9);assert.equal(r.segmentResults.length,3);near(r.coverageGapM,0);
});

test('SPT multi-layer warns when geology does not cover full shaft',()=>{
  const r=calculateSptPile10304({pileType:'driven',sectionType:'square',widthM:.4,heightM:.4,lengthM:10,tipDepthM:10,shaftStartDepthM:0,closedTip:true,eta:1,
    layers:[{top:0,bottom:4,soilGroup:'sand',sptN:10},{top:4,bottom:8,soilGroup:'sand',sptN:20},{top:9,bottom:11,soilGroup:'sand',sptN:30}],
    sptPoints:[{depthM:9.4,N:30},{depthM:9.8,N:30},{depthM:10.2,N:30}]});
  assert.equal(r.ok,true);near(r.coverageGapM,1,1e-9);assert.ok(r.warnings.length>0);
});

test('Production SPT workbook exposes b/h/D inputs and derived Excel formulas',async()=>{
  const out=await export10304AdvancedWorkflowWorkbook('spt',base,{returnBuffer:true});
  assert.ok(out?.buffer?.byteLength>1000);
  const wb=new ExcelJS.Workbook();await wb.xlsx.load(out.buffer);
  const inp=wb.getWorksheet('01_INPUT'),calc=wb.getWorksheet('02_CALC');assert.ok(inp&&calc);
  for(const label of ['Tiết diện','b','h','D','A_b (dẫn xuất)','u (dẫn xuất)','L'])assert.ok(labelRow(inp,label),`missing INPUT ${label}`);
  const ar=labelRow(inp,'A_b (dẫn xuất)'),ur=labelRow(inp,'u (dẫn xuất)'),abr=labelRow(calc,'A_b'),ucr=labelRow(calc,'u');
  assert.equal(typeof inp.getCell(ar,2).value?.formula,'string');assert.equal(typeof inp.getCell(ur,2).value?.formula,'string');
  assert.equal(typeof calc.getCell(abr,2).value?.formula,'string');assert.equal(typeof calc.getCell(ucr,2).value?.formula,'string');
  const all=[];for(const ws of wb.worksheets)ws.eachRow(row=>row.eachCell(cell=>{if(cell.value&&typeof cell.value==='object'&&cell.value.formula)all.push(cell.value.formula)}));
  assert.ok(all.some(f=>f.includes('/1000')));assert.ok(all.some(f=>f.includes('PI()')));assert.ok(all.some(f=>f.includes('MIN(')));
});
