#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { resolveCliOutputPath } from './cross-platform-paths.mjs';
import { export10304AdvancedWorkflowWorkbook, exportDrivenPileWorkflowWorkbook } from '../src/excel-export-compat.js';
import { MODERN_EXCEL_FORMULA_RE, downgradeModernExcelFormula } from '../src/excel-formula-compat.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const releaseMeta=JSON.parse(fs.readFileSync(path.join(root,'public/release-meta.json'),'utf8'));
assert.equal(pkg.version,'1.27.0','Excel Production smoke yêu cầu App Version 1.27.0');
assert.equal(releaseMeta.appVersion,pkg.version);
assert.equal(releaseMeta.goldenBaseline,'1.25.7');
assert.equal(releaseMeta.searchBrain,'1.9.23');
assert.equal(releaseMeta.searchBrainStatus,'LOCKED');

// Windows DCE absolute-path regression: never create D:\\D:\\...
{
  const abs='D:\\a\\hnl-pile-standards-ai\\hnl-pile-standards-ai\\artifacts\\dce-udf-behavioral\\dce-udf-behavioral-golden-v1.25.7.json';
  const cwd='D:\\a\\hnl-pile-standards-ai\\hnl-pile-standards-ai';
  assert.equal(resolveCliOutputPath(abs,'unused',{cwd,pathImpl:path.win32}),path.win32.normalize(abs));
}

async function hasNativeChart(buffer){
  const zip=await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).some(n=>/^xl\/drawings\/charts\/chart\d+\.xml$/.test(n));
}
function assertNoInternalCodeDropdowns(wb,label){
  const internal=/^(?:square|circle|rectangle|hammer|press|sand|clay|sandyClay|clayeySand|bored|vibro-pipe|screw|driven|yes|no|YES|NO|long|short|Tension|Compression|plain|coldRibbed|hotRibbed)$/i;
  const bad=[];
  for(const ws of wb.worksheets){if(ws.name==='99_MA_NOI_BO') continue;ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{const dv=cell.dataValidation;if(dv?.type==='list'&&Array.isArray(dv.formulae)) for(const f of dv.formulae){const text=String(f||'');if(text.length>=2&&text[0]==='"'&&text[text.length-1]==='"'){const list=text.slice(1,-1);if(list.split(',').some(v=>internal.test(v.trim()))) bad.push(ws.name+'!'+cell.address+':'+list);}}}));}
  assert.deepEqual(bad,[],label+' còn dropdown internal code: '+bad.join(' | '));
}

function assertLegacyFormulaCompatibility(wb,label){
  const bad=[],tooLong=[]; let formulas=0;
  for(const ws of wb.worksheets){
    ws.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},cell=>{
      const f=cell.value&&typeof cell.value==='object'&&typeof cell.value.formula==='string'?cell.value.formula:'';
      if(!f) return; formulas++;
      if(MODERN_EXCEL_FORMULA_RE.test(f)) bad.push(ws.name+'!'+cell.address+':'+f.slice(0,180));
      if(f.length>8192) tooLong.push(ws.name+'!'+cell.address+':'+f.length);
    }));
  }
  assert.deepEqual(bad,[],label+' còn LET/XLOOKUP/LAMBDA/SWITCH/IFS: '+bad.join(' | '));
  assert.deepEqual(tooLong,[],label+' có công thức vượt 8192 ký tự: '+tooLong.join(' | '));
  assert.ok(formulas>0,label+' không có công thức để kiểm tra');
  return formulas;
}

// Parser-level guards for the exact modern constructs used by HNL workbooks.
{
  const samples=[
    'XLOOKUP(A1,B1:B4,C1:C4,NA())',
    'XLOOKUP("*Cạnh*",A:A,B:B,"",2)',
    'SWITCH(A1,"a",1,"b",2,"BLOCK")',
    'IFS(A1<=1,10,A1=2,20,TRUE,"CẦN")',
    'LET(x,A1,y,B1,IF(x>0,x+y,0))',
    'LET(x,A1,val,LAMBDA(cc,INDEX(B1:C2,1,cc)),val(2))'
  ];
  for(const f of samples){const out=downgradeModernExcelFormula(f);assert.doesNotMatch(out,MODERN_EXCEL_FORMULA_RE);assert.ok(out.length<=8192);}
}

function rowByLabel(ws,label){
  for(let r=1;r<=ws.rowCount;r++) if(String(ws.getCell(r,1).value??'').trim()===label) return r;
  return null;
}

// Excel Production Pass 1: explicit SPT summary — Vietnamese dropdown + legacy formula + native chart.
const spt=await export10304AdvancedWorkflowWorkbook('spt',{
  inputMode:'EXPLICIT_SPT_SUMMARY',pileType:'driven',eta:1,nBarTip:20,nsShaft:20,
  areaM2:0.16,perimeterM:1.6,shaftLengthM:10,gammaK:1.5,gammaN:1.15
},{returnBuffer:true});
assert.ok(spt?.buffer,'Không tạo được buffer SPT explicit');
{
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(spt.buffer);
  const inp=wb.getWorksheet('01_INPUT'),calc=wb.getWorksheet('02_CALC'),map=wb.getWorksheet('99_MA_NOI_BO'),vis=wb.getWorksheet('08_BIEU_DO');
  assert.ok(inp&&calc&&map&&vis,'SPT explicit thiếu sheet Excel Production');
  assert.equal(map.state,'veryHidden');
  const pile=rowByLabel(inp,'Loại cọc'),qb=rowByLabel(calc,'q_b'),fs=rowByLabel(calc,'f_s');
  assert.equal(String(inp.getCell(pile,2).value),'Cọc đóng/ép');
  assert.equal(inp.getCell(pile,2).dataValidation?.type,'list');
  const qbf=String(calc.getCell(qb,2).value?.formula||''),fsf=String(calc.getCell(fs,2).value?.formula||'');
  assert.match(qbf,/VLOOKUP\(/i); assert.match(qbf,/MIN\(/i);
  assert.match(fsf,/VLOOKUP\(/i); assert.match(fsf,/MIN\(/i);
  assert.doesNotMatch(qbf,/\b(?:LET|XLOOKUP|LAMBDA)\s*\(/i);
  assert.doesNotMatch(fsf,/\b(?:LET|XLOOKUP|LAMBDA)\s*\(/i);
  assert.ok(await hasNativeChart(spt.buffer),'SPT explicit thiếu native chart');
  assertLegacyFormulaCompatibility(wb,'SPT explicit');
}

// Excel Production Pass 2: driven pile — Vietnamese finite-choice dropdowns + hidden codes + native chart.
const driven=await exportDrivenPileWorkflowWorkbook({
  shape:'square',sideM:.4,lengthM:12,tipDepthM:12,method:'hammer',gammaC:1,gammaK:1.4,gammaN:1.15,
  layers:[
    {top:0,bottom:4,soilGroup:'clay',IL:.6},
    {top:4,bottom:8,soilGroup:'sand',sandType:'fine'},
    {top:8,bottom:15,soilGroup:'sand',sandType:'medium'}
  ]
},{returnBuffer:true});
assert.ok(driven?.buffer,'Không tạo được buffer cọc đóng/ép');
{
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(driven.buffer);
  const inp=wb.getWorksheet('01_INPUT'),geo=wb.getWorksheet('02_DIA_CHAT'),map=wb.getWorksheet('99_MA_NOI_BO'),vis=wb.getWorksheet('09_BIEU_DO');
  assert.ok(inp&&geo&&map&&vis,'Driven thiếu sheet Excel Production');
  assert.equal(map.state,'veryHidden');
  const shape=rowByLabel(inp,'Tiết diện'),method=rowByLabel(inp,'Phương pháp');
  assert.equal(String(inp.getCell(shape,2).value),'Vuông');
  assert.equal(String(inp.getCell(method,2).value),'Đóng bằng búa');
  assert.equal(inp.getCell(shape,2).dataValidation?.type,'list');
  assert.equal(inp.getCell(method,2).dataValidation?.type,'list');
  assert.equal(String(geo.getCell(2,4).value),'Đất dính');
  assert.equal(String(geo.getCell(3,4).value),'Đất cát');
  assert.equal(String(geo.getCell(3,5).value),'Cát mịn');
  assert.equal(geo.getCell(2,4).dataValidation?.type,'list');
  assert.equal(geo.getCell(2,5).dataValidation?.type,'list');
  assert.equal(inp.getColumn(5).hidden,true);
  assert.equal(geo.getColumn(9).hidden,true);
  assert.equal(geo.getColumn(10).hidden,true);
  const areaFormula=String(wb.getWorksheet('05_CALC_10304').getCell('B2').value?.formula||'');
  assert.match(areaFormula,/'01_INPUT'!E2|E\d+/);
  assert.ok(await hasNativeChart(driven.buffer),'Driven thiếu native chart');
  assertLegacyFormulaCompatibility(wb,'Driven');
}

// Excel Production Pass 3: generic finite-choice localization outside dedicated SPT/driven adapters.
const rock=await export10304AdvancedWorkflowWorkbook('end-bearing',{shape:'circle',diameterM:1,rockCompressiveStrengthKpa:31300,rqdPercent:30,gammaG:1.4,embedmentLengthM:5,embeddedOuterDiameterM:1,minimumQbKpa:1000,gammaK:1.4,gammaN:1.15},{returnBuffer:true});
assert.ok(rock?.buffer,'Không tạo được buffer end-bearing compat');
{
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(rock.buffer);
  const inp=wb.getWorksheet('01_DAU_VAO'),map=wb.getWorksheet('99_MA_NOI_BO');
  assert.ok(inp&&map,'End-bearing compat thiếu 01_DAU_VAO hoặc 99_MA_NOI_BO');
  assert.equal(map.state,'veryHidden');
  assertNoInternalCodeDropdowns(wb,'End-bearing compat');
  const shape=rowByLabel(inp,'Tiết diện');
  assert.equal(String(inp.getCell(shape,2).value),'Tròn');
  assert.match(String(inp.getCell(shape,2).dataValidation?.formulae?.[0]||''),/Tròn/);
  assertLegacyFormulaCompatibility(wb,'End-bearing');
}


// Excel Production Pass 4: compatibility coverage for every modern-formula family in core.
const compatCases=[
  ['CPT', 'cpt', {A:.16,u:1.6,h:12,qs:5000,fs:40,pile:'driven',load:'compression',soil:'sand',probe:'mechanical',b1Auto:true,b2Auto:true}],
  ['Bored-Table8','bored',{gammaC:1,gammaRR:1,gammaRf:1,A:.785,u:3.14,sumFh:900,qbLookupMode:'table8',depth:12,IL:.3}],
  ['Bored-Table7','bored',{gammaC:1,gammaRR:1,gammaRf:1,A:.785,u:3.14,sumFh:900,qbLookupMode:'table7',phi:31,gamma1p:10,gamma1:18,d:1,depth:15}],
  ['Settlement-Single','settlement-single',{N:1,G1:20,G2:30,L:20,d:.6,v1:.3,v2:.3,EA:10000}],
  ['Raw-SPT','spt',{pileType:'driven',shape:'square',sideM:.4,lengthM:10,tipDepthM:10,eta:1,gammaK:1.5,gammaN:1.15,layers:[{top:0,bottom:5,soilGroup:'sand',sptN:15},{top:5,bottom:12,soilGroup:'sand',sptN:20}],sptPoints:[{depthM:8,N:18},{depthM:10,N:20},{depthM:12,N:22}]}],
  ['Raw-Bored','bored',{shape:'circle',diameterM:1,tipDepthM:12,shaftStartDepthM:0,maxSegmentM:2,gammaK:1.4,gammaN:1.15,tipPhiDeg:31,layers:[{top:0,bottom:5,soilGroup:'clay',IL:.5},{top:5,bottom:15,soilGroup:'sand',sandType:'medium',phiDeg:31}]}]
];
let compatFormulaCount=0;
for(const [label,wf,input] of compatCases){
  const out=await export10304AdvancedWorkflowWorkbook(wf,input,{returnBuffer:true});
  assert.ok(out?.buffer,label+' không tạo được buffer');
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(out.buffer);
  compatFormulaCount+=assertLegacyFormulaCompatibility(wb,label);
  assertNoInternalCodeDropdowns(wb,label);
}
assert.ok(compatFormulaCount>20,'Compatibility matrix chưa quét đủ công thức');

console.log(JSON.stringify({
  ok:true,
  appVersion:pkg.version,
  goldenBaseline:releaseMeta.goldenBaseline,
  searchBrain:`${releaseMeta.searchBrain} ${releaseMeta.searchBrainStatus}`,
  windowsPathPortable:true,
  explicitSpt:{vietnameseDropdown:true,legacyFormula:true,nativeChart:true},
  driven:{vietnameseDropdowns:true,hiddenInternalCodes:true,nativeChart:true},
  genericCompat:{vietnameseDropdowns:true,hiddenInternalCodeMap:true},
  legacyFormulaCompat:{zeroModernFunctions:true,maxFormulaLength:8192,representativeCases:compatCases.map(x=>x[0])}
},null,2));
