import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createP4ExtractionPacket, packetFromP32Run, detectTableFromText, extractFormulaCandidates,
  compileSafeExcelFormula, collectContextualParameters, buildParameterClarifications,
  attachAutoDetections, buildP4ExcelPlan, assertP4CalculationBarrier, classifyP4Trust, exportP4ExcelWorkbook
} from '../src/p4-pdf-excel-intelligence.js';
import { parseVariableQuery, extractAssignments, analyzeCandidateAmbiguity } from '../src/pdf-excel-intelligence/core.js';

const SRC='a494ee4a710de3b8e4fbfc48815e3a0039ae577f';

function prov(extra={}){return {file:'TCVN.pdf',standard:'TCVN',page:10,bbox:[0.1,0.1,0.9,0.5],sourceType:'pdf-native',engine:'pdfjs-native-region',state:'VERIFIED',sourceSha:SRC,...extra};}

test('P4 trust: BENCHMARKED P3.2 is never calculation eligible',()=>{
  assert.deepEqual(parseVariableQuery('Tìm giá trị a, b trong tài liệu rồi xuất Excel'),['a','b']);
  assert.equal(extractAssignments('a = 0,7; b = 1.25 kPa','a')[0]?.valueRaw,'0,7');
  const t=classifyP4Trust(prov({state:'BENCHMARKED'}));
  assert.equal(t.semanticState,'BENCHMARKED'); assert.equal(t.calculationEligible,false); assert.equal(t.excelFormulaEligible,false);
});

test('P4 trust: OCR/Vision needs user confirmation even when VERIFIED',()=>{
  const no=classifyP4Trust(prov({sourceType:'ocr',engine:'deepdoc-vietocr-region',state:'VERIFIED'}));
  const yes=classifyP4Trust({...prov({sourceType:'ocr',engine:'deepdoc-vietocr-region',state:'VERIFIED'}),userConfirmed:true});
  assert.equal(no.calculationEligible,false); assert.equal(yes.calculationEligible,true);
});

test('table detector turns markdown table into consistent cell rows',()=>{
  const d=detectTableFromText('| D | t | PC | PHC |\n|---|---|---|---|\n|300|60|A|B|\n|350|65|A|C|');
  assert.equal(d.ok,true); assert.equal(d.columnCount,4); assert.equal(d.rows.length,3); assert.ok(d.confidence>=0.9);
});

test('formula extraction + VERIFIED safe compile produces real Excel formula',()=>{
  const c=extractFormulaCandidates('A0 = PI()/4*(D^2-(D-2*t)^2)',prov())[0];
  const r=compileSafeExcelFormula(c,{D:"'04_THAM_SO'!$D$2",t:"'04_THAM_SO'!$D$3"},{trust:classifyP4Trust(prov())});
  assert.equal(r.ok,true); assert.match(r.excelFormula,/^=/); assert.match(r.excelFormula,/\$D\$2/);
});

test('BENCHMARKED formula gets preview only, not real Excel formula eligibility',()=>{
  const p=prov({state:'BENCHMARKED'}), c=extractFormulaCandidates('Ra = 2*Rk',p)[0];
  const r=compileSafeExcelFormula(c,{Rk:"'04_THAM_SO'!$D$2"},{trust:classifyP4Trust(p)});
  assert.equal(r.ok,false); assert.equal(r.state,'REVIEW'); assert.ok(r.previewFormula?.startsWith('='));
});

test('dangerous/external Excel formula is blocked',()=>{
  const r=compileSafeExcelFormula({rhs:'WEBSERVICE("https://example.com")'},{},{trust:classifyP4Trust(prov())});
  assert.equal(r.ok,false); assert.equal(r.state,'BLOCK'); assert.equal(r.excelFormula,null);
});

test('same symbol a in multiple contexts forces clarification',()=>{
  const formulas=[
    {id:'f1',rhs:'a+b',context:'CT 1',provenance:{...prov(),page:20,section:'CT 1'}},
    {id:'f2',rhs:'a*c',context:'CT 2',provenance:{...prov(),page:30,section:'CT 2'}}
  ];
  const ps=collectContextualParameters(formulas,[]), qs=buildParameterClarifications(ps);
  const q=qs.find(x=>x.symbol==='a'); assert.ok(q); assert.equal(q.type,'AMBIGUOUS_SYMBOL'); assert.equal(q.contexts.length,2);
  const issues=analyzeCandidateAmbiguity({variables:['a'],candidates:[{variable:'a',value:1,unit:'m',page:1},{variable:'a',value:2,unit:'m',page:2}]}); assert.equal(issues[0]?.type,'MULTIPLE_VALUES');
});

test('explicit calculation barrier blocks unverified packet',()=>{
  const p=createP4ExtractionPacket({provenance:prov({state:'BENCHMARKED'})});
  assert.throws(()=>assertP4CalculationBarrier(p),/P4_CALCULATION_BLOCK/);
});

test('P4 Excel plan contains Vietnamese provenance/review sheets and no internal promotion',async (t)=>{
  const p=attachAutoDetections(createP4ExtractionPacket({provenance:prov({state:'BENCHMARKED'}),text:'Bảng 1 | D | t\nB | 300 | 60\nA0 = PI()/4*(D^2-(D-2*t)^2)'}));
  const plan=buildP4ExcelPlan([p]);
  assert.equal(plan.productionMutationAllowed,false); assert.equal(plan.calculationEngineMutationAllowed,false);
  const names=plan.workbook.sheets.map(x=>x.name);
  assert.deepEqual(names,['00_TONG_QUAN','01_NGUON','02_BANG_TRICH_XUAT','07_VAN_BAN_NGUON','03_CONG_THUC','04_THAM_SO','05_REVIEW','06_ANH_NGUON']);
  assert.equal(plan.summary.calculationEligiblePackets,0);
  try {
    await import('exceljs');
    const out=await exportP4ExcelWorkbook([p],{validateOnly:true,fileName:'P4_RUNTIME_TEST.xlsx'});
    assert.equal(out.ok,true); assert.ok(out.buffer?.byteLength>1000); assert.ok(out.workbook?.getWorksheet('00_TONG_QUAN'));
  } catch (e) {
    if (e?.code==='ERR_MODULE_NOT_FOUND' || /Cannot find package 'exceljs'/.test(String(e?.message||e))) t.diagnostic('exceljs unavailable locally; CI with npm ci must execute this runtime assertion');
    else throw e;
  }
});

test('final P3.2 JSON ingests as BENCHMARKED only and preserves sourceSha/page/bbox',()=>{
  const path=process.env.HNL_P32_JSON || '/mnt/data/HNL_P3.2_R1_FINAL_REAL_PDF_UI_GOLDEN_2026-08-28T23-17-02-243Z.json';
  if(!fs.existsSync(path)) return;
  const j=JSON.parse(fs.readFileSync(path,'utf8'));
  const run=j.runsByCase.P32_7888_TABLE1_P10_11[0];
  const p=packetFromP32Run(run,j.environment);
  assert.equal(p.trust.semanticState,'BENCHMARKED'); assert.equal(p.trust.calculationEligible,false);
  assert.equal(p.source.sourceSha,SRC); assert.equal(p.source.page,10); assert.equal(p.source.bbox.length,4);
});

test('build plan maps VERIFIED parameters to distinct Excel input rows',()=>{
  const packet=createP4ExtractionPacket({
    provenance:prov(),
    formulas:[...extractFormulaCandidates('A0 = PI()/4*(D^2-(D-2*t)^2)',prov())],
    parameters:[
      {symbol:'D',label:'D',value:600,unit:'mm',contextId:'geom',context:'Hình học',state:'VERIFIED',provenance:prov()},
      {symbol:'t',label:'t',value:90,unit:'mm',contextId:'geom',context:'Hình học',state:'VERIFIED',provenance:prov()}
    ]
  });
  const plan=buildP4ExcelPlan([packet]);
  const formulas=plan.workbook.sheets.find(x=>x.name==='03_CONG_THUC').rows;
  assert.equal(formulas.length,1);
  assert.equal(formulas[0][5],'ĐÃ XÁC MINH');
  assert.match(formulas[0][4],/\$D\$2/);
  assert.match(formulas[0][4],/\$D\$3/);
});

test('malicious cell mapping is blocked even with verified source',()=>{
  const c=extractFormulaCandidates('R = A+B',prov())[0];
  const r=compileSafeExcelFormula(c,{A:"'04_THAM_SO'!$D$2",B:"WEBSERVICE(\"x\")"},{trust:classifyP4Trust(prov())});
  assert.equal(r.ok,false); assert.equal(r.state,'BLOCK');
});


test('low usable confidence is forced to REVIEW',()=>{
  const t=classifyP4Trust(prov({state:'VERIFIED',sourceType:'ocr',engine:'vietocr',confidence:0.42,confidenceUsable:true}));
  assert.equal(t.semanticState,'REVIEW'); assert.equal(t.calculationEligible,false); assert.match(t.reason,/Confidence/);
});

test('Excel plan localizes internal source state/type and exports raw PDF text',()=>{
  const p=createP4ExtractionPacket({provenance:prov({state:'BENCHMARKED'}),text:'Nội dung PDF thuần'});
  const plan=buildP4ExcelPlan([p]);
  const src=plan.workbook.sheets.find(x=>x.name==='01_NGUON').rows[0];
  assert.equal(src[8],'PDF có lớp chữ'); assert.equal(src[9],'ĐÃ BENCHMARK');
  const txt=plan.workbook.sheets.find(x=>x.name==='07_VAN_BAN_NGUON').rows[0];
  assert.equal(txt[5],'Nội dung PDF thuần');
});

test('finite-choice parameter is preserved for Excel dropdown generation',()=>{
  const packet=createP4ExtractionPacket({provenance:prov(),parameters:[{symbol:'type',label:'Loại cọc',value:'PHC',state:'VERIFIED',choices:['PC','PHC','NPH'],provenance:prov()}]});
  const plan=buildP4ExcelPlan([packet]);
  const row=plan.workbook.sheets.find(x=>x.name==='04_THAM_SO').rows[0];
  assert.equal(row[10],'PC | PHC | NPH');
});

import { p4PacketFromSelectionSource, p4PacketFromImageReview } from '../src/pdf-excel-intelligence/adapters.js';

test('P4 UI adapter maps native PDF region provenance without promoting it',()=>{
  const p=p4PacketFromSelectionSource({docId:'d1',docName:'TCVN.pdf',standard:'TCVN',page:12,text:'Bảng 1 | D | t',method:'text-layer',sourceRectNorm:{x:.1,y:.2,width:.5,height:.3}},{commit:SRC});
  assert.equal(p.source.sourceType,'pdf-native'); assert.deepEqual(p.source.bbox,[.1,.2,.6,.5]);
  assert.equal(p.source.state,'REVIEW'); assert.equal(p.trust.calculationEligible,false); assert.equal(p.source.sourceSha,SRC);
});

test('P4 UI adapter maps local OCR/Vision region to REVIEW and preserves source image',()=>{
  const o=p4PacketFromSelectionSource({docName:'scan.pdf',page:2,text:'N=20',method:'local-ocr',sourceRectNorm:{x:0,y:0,width:1,height:1},image:{mimeType:'image/png',data:'AA==' }},{commit:SRC});
  assert.equal(o.source.sourceType,'ocr'); assert.equal(o.trust.calculationEligible,false); assert.equal(o.figures.length,1); assert.match(o.figures[0].dataUrl,/^data:image\/png;base64,/);
  const v=p4PacketFromSelectionSource({docName:'scan.pdf',page:2,text:'N=20',method:'vision-ai',sourceRectNorm:{x:0,y:0,width:1,height:1},image:{mimeType:'image/png',data:'AA==' }},{commit:SRC});
  assert.equal(v.source.sourceType,'vision-reuse'); assert.equal(v.source.state,'REVIEW');
});


test('P4 image review adapter exports extracted fields + source image as REVIEW only',()=>{
  const p=p4PacketFromImageReview({
    fields:[
      {key:'pile.diameterMm',label:'Đường kính thân cọc',value:'600',unit:'mm',confidence:.96,sourceName:'de-bai.png'},
      {key:'pile.lengthM',label:'Chiều dài cọc',value:'12',unit:'m',confidence:.72,sourceName:'de-bai.png'}
    ],
    figures:[{name:'de-bai.png',dataUrl:'data:image/png;base64,AA=='}]
  },{commit:SRC});
  assert.equal(p.source.sourceType,'image');
  assert.equal(p.source.state,'REVIEW');
  assert.equal(p.trust.calculationEligible,false);
  assert.equal(p.parameters.length,2);
  assert.equal(p.parameters[0].state,'REVIEW');
  assert.equal(p.figures.length,1);
  const plan=buildP4ExcelPlan([p]);
  assert.equal(plan.summary.parameters,2);
  assert.equal(plan.summary.figures,1);
  assert.equal(plan.summary.calculationEligiblePackets,0);
});
